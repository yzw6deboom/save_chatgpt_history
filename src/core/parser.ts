import type {
  AttachmentRef,
  Citation,
  ConversationMessage,
  ConversationResult,
  ConversationRole,
  ExtractedContent,
  MappingNode,
  ParseOptions,
  ParseWarning,
  RawConversation,
  RawMessage,
} from "./types";

const DEFAULT_OPTIONS: ParseOptions = {
  source: "unknown",
  includeCitations: false,
  includeHiddenMessages: false,
  includeMetadata: false,
  includeModel: false,
  includeSystemMessages: false,
  includeTimestamps: true,
  includeToolMessages: false,
  outputFormat: "markdown",
};

export function normalizeRawConversation(raw: unknown): RawConversation {
  const root = asRecord(raw);
  const mapping = normalizeMapping(root.mapping);

  return {
    title: stringOrNull(root.title),
    create_time: root.create_time,
    update_time: root.update_time,
    conversation_id: stringOrNull(root.conversation_id),
    default_model_slug: stringOrNull(root.default_model_slug),
    current_node: stringOrNull(root.current_node),
    mapping,
  };
}

export function parseConversation(
  raw: unknown,
  options: Partial<ParseOptions> = {},
): ConversationResult {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeRawConversation(raw);
  const warnings: ParseWarning[] = [];

  if (!normalized.mapping) {
    warnings.push({
      code: "MAPPING_MISSING",
      message: "ChatGPT conversation mapping field is missing or invalid.",
      severity: "error",
    });

    return buildResult(normalized, resolvedOptions, warnings, [], null);
  }

  const path = resolveCurrentPath(
    normalized.mapping,
    normalized.current_node,
    warnings,
  );
  const extractionOptions: ParseOptions = {
    ...resolvedOptions,
    includeMetadata: true,
  };
  const messages = path
    .map((node) =>
      extractMessage(node, normalized, warnings, extractionOptions),
    )
    .filter((message): message is ConversationMessage => Boolean(message))
    .filter((message) => shouldKeepMessage(message, resolvedOptions, warnings))
    .map((message) => stripMetadataIfNeeded(message, resolvedOptions));

  return buildResult(
    normalized,
    resolvedOptions,
    warnings,
    messages,
    normalized.mapping,
  );
}

export function resolveCurrentPath(
  mapping: Record<string, MappingNode>,
  currentNode: string | null | undefined,
  warnings: ParseWarning[],
): MappingNode[] {
  const startNodeId = currentNode || inferLatestLeafNode(mapping, warnings);
  const path: MappingNode[] = [];
  const visited = new Set<string>();
  let nodeId: string | null | undefined = startNodeId;

  if (currentNode && !mapping[currentNode]) {
    warnings.push({
      code: "CURRENT_NODE_NOT_FOUND",
      message: `Current node ${currentNode} does not exist in mapping. Falling back to latest leaf node.`,
      node_id: currentNode,
      severity: "warning",
    });
    nodeId = inferLatestLeafNode(mapping, warnings);
  }

  while (nodeId) {
    if (visited.has(nodeId)) {
      warnings.push({
        code: "CYCLE_DETECTED",
        message: `Cycle detected at node ${nodeId}.`,
        node_id: nodeId,
        severity: "warning",
      });
      break;
    }

    const node: MappingNode | undefined = mapping[nodeId];
    if (!node) {
      warnings.push({
        code: "NODE_MISSING",
        message: `Node ${nodeId} does not exist in mapping.`,
        node_id: nodeId,
        severity: "warning",
      });
      break;
    }

    visited.add(nodeId);
    path.push(node);
    nodeId = node.parent;
  }

  return path.reverse();
}

export function inferLatestLeafNode(
  mapping: Record<string, MappingNode>,
  warnings: ParseWarning[],
): string | null {
  warnings.push({
    code: "CURRENT_NODE_MISSING",
    message: "Current node is missing. Falling back to latest leaf node.",
    severity: "warning",
  });

  const nodes = Object.values(mapping);
  if (nodes.length === 0) return null;

  const referencedAsParent = new Set<string>();
  for (const node of nodes) {
    if (node.parent) referencedAsParent.add(node.parent);
  }

  const leafNodes = nodes.filter(
    (node) => node.children.length === 0 && !referencedAsParent.has(node.id),
  );
  const candidates =
    leafNodes.length > 0
      ? leafNodes
      : nodes.filter((node) => node.children.length === 0);
  const pool = candidates.length > 0 ? candidates : nodes;

  return pool.sort((a, b) => getNodeTime(b) - getNodeTime(a))[0]?.id ?? null;
}

export function extractMessage(
  node: MappingNode,
  root: RawConversation,
  warnings: ParseWarning[],
  options: ParseOptions = DEFAULT_OPTIONS,
): ConversationMessage | null {
  const rawMessage = node.message;
  if (!rawMessage) return null;

  const messageMetadata = asRecord(rawMessage.metadata);
  const content = extractContent(rawMessage.content, warnings, node.id);
  const role = normalizeRole(rawMessage.author?.role);
  const message: ConversationMessage = {
    id: stringOrNull(rawMessage.id) ?? node.id,
    node_id: node.id,
    parent_node_id: node.parent,
    role,
    author_name: stringOrNull(rawMessage.author?.name),
    content: content.text,
    content_type: content.content_type,
    created_at:
      options.includeTimestamps === false
        ? null
        : toIsoTime(rawMessage.create_time, warnings, node.id),
    updated_at:
      options.includeTimestamps === false
        ? null
        : toIsoTime(rawMessage.update_time, warnings, node.id),
    model:
      options.includeModel === true ? extractModel(rawMessage, root) : null,
    status: stringOrNull(rawMessage.status),
    end_turn:
      typeof rawMessage.end_turn === "boolean" ? rawMessage.end_turn : null,
    citations:
      options.includeCitations === true ? extractCitations(rawMessage) : [],
    attachments: content.attachments,
  };

  if (options.includeMetadata === true) {
    message.metadata = messageMetadata;
  }

  return message;
}

export function shouldKeepMessage(
  message: ConversationMessage,
  options: ParseOptions,
  warnings: ParseWarning[] = [],
): boolean {
  if (!message.content.trim()) {
    warnings.push({
      code: "EMPTY_MESSAGE_FILTERED",
      message: `Message ${message.node_id} was filtered because its content is empty.`,
      node_id: message.node_id,
      severity: "info",
    });
    return false;
  }

  if (
    message.metadata?.is_visually_hidden_from_conversation === true &&
    options.includeHiddenMessages !== true
  ) {
    warnings.push({
      code: "HIDDEN_MESSAGE_FILTERED",
      message: `Message ${message.node_id} was filtered because it is hidden from the conversation.`,
      node_id: message.node_id,
      severity: "info",
    });
    return false;
  }

  if (message.role === "system") return Boolean(options.includeSystemMessages);
  if (message.role === "tool") return Boolean(options.includeToolMessages);
  if (message.content_type === "user_editable_context") return false;
  if (message.content_type === "model_editable_context") return false;

  return message.role === "user" || message.role === "assistant";
}

export function extractContent(
  content: unknown,
  warnings: ParseWarning[] = [],
  nodeId?: string,
): ExtractedContent {
  try {
    const value = asRecord(content);
    const contentType = stringOrNull(value.content_type) ?? "unknown";

    if (contentType === "text" || contentType === "multimodal_text") {
      const parts = Array.isArray(value.parts) ? value.parts : [];
      return {
        content_type: contentType,
        text: parts.map(extractPartText).filter(Boolean).join("\n\n"),
        attachments: extractAttachments(parts),
      };
    }

    if (contentType === "code") {
      return {
        content_type: contentType,
        text: stringOrNull(value.text) ?? "",
        attachments: [],
      };
    }

    if (contentType === "user_editable_context") {
      return {
        content_type: contentType,
        text: [value.user_profile, value.user_instructions]
          .map(stringOrNull)
          .filter(Boolean)
          .join("\n\n"),
        attachments: [],
      };
    }

    const text = fallbackExtractText(value);
    if (!text) {
      warnings.push({
        code: "UNSUPPORTED_CONTENT_TYPE",
        message: `Unsupported content type ${contentType}.`,
        ...(nodeId ? { node_id: nodeId } : {}),
        severity: "warning",
      });
    }

    return {
      content_type: contentType,
      text,
      attachments: [],
    };
  } catch {
    warnings.push({
      code: "CONTENT_EXTRACTION_FAILED",
      message: "Failed to extract message content.",
      ...(nodeId ? { node_id: nodeId } : {}),
      severity: "warning",
    });

    return {
      content_type: "unknown",
      text: "",
      attachments: [],
    };
  }
}

export function extractCitations(message: RawMessage): Citation[] {
  const metadata = asRecord(message.metadata);
  const references = [
    metadata.content_references,
    metadata.citations,
    metadata.conversation_context_citation_metadata,
  ].flatMap((value) => (Array.isArray(value) ? value : []));

  const citations: Citation[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    for (const citation of citationsFromReference(reference)) {
      const key = `${citation.type ?? ""}|${citation.title ?? ""}|${citation.url ?? ""}|${citation.matched_text ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push(citation);
    }
  }

  return citations;
}

export function toIsoTime(
  value: unknown,
  warnings: ParseWarning[] = [],
  nodeId?: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;

  const timestamp = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(timestamp)) {
    warnings.push({
      code: "INVALID_TIMESTAMP",
      message: `Invalid timestamp value: ${String(value)}.`,
      ...(nodeId ? { node_id: nodeId } : {}),
      severity: "warning",
    });
    return null;
  }

  const milliseconds =
    timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    warnings.push({
      code: "INVALID_TIMESTAMP",
      message: `Invalid timestamp value: ${String(value)}.`,
      ...(nodeId ? { node_id: nodeId } : {}),
      severity: "warning",
    });
    return null;
  }

  return date.toISOString();
}

function stripMetadataIfNeeded(
  message: ConversationMessage,
  options: ParseOptions,
): ConversationMessage {
  if (options.includeMetadata === true) return message;

  const { metadata: _metadata, ...messageWithoutMetadata } = message;
  return messageWithoutMetadata;
}

function buildResult(
  normalized: RawConversation,
  options: ParseOptions,
  warnings: ParseWarning[],
  messages: ConversationMessage[],
  mapping: Record<string, MappingNode> | null,
): ConversationResult {
  return {
    schema_version: "1.0",
    source: options.source,
    conversation_id: normalized.conversation_id,
    title: normalized.title || "Untitled Conversation",
    created_at:
      options.includeTimestamps === false
        ? null
        : toIsoTime(normalized.create_time, warnings),
    updated_at:
      options.includeTimestamps === false
        ? null
        : toIsoTime(normalized.update_time, warnings),
    default_model: normalized.default_model_slug,
    current_node: normalized.current_node,
    message_count: messages.length,
    branch_count: mapping ? countBranches(mapping) : 0,
    warnings,
    messages,
    raw_summary: mapping
      ? summarizeRaw(mapping)
      : { node_count: 0, root_count: 0, leaf_count: 0 },
  };
}

function normalizeMapping(value: unknown): Record<string, MappingNode> | null {
  if (!isRecord(value)) return null;

  const mapping: Record<string, MappingNode> = {};
  for (const [key, rawNode] of Object.entries(value)) {
    if (!isRecord(rawNode)) continue;

    const id = stringOrNull(rawNode.id) ?? key;
    const rawChildren = Array.isArray(rawNode.children) ? rawNode.children : [];
    mapping[key] = {
      id,
      message: isRecord(rawNode.message)
        ? (rawNode.message as RawMessage)
        : null,
      parent: stringOrNull(rawNode.parent),
      children: rawChildren
        .map(stringOrNull)
        .filter((child): child is string => Boolean(child)),
    };
  }

  return mapping;
}

function normalizeRole(value: unknown): ConversationRole {
  if (value === "user" || value === "assistant" || value === "system")
    return value;
  if (value === "tool" || value === "tool_result") return "tool";
  return "unknown";
}

function extractModel(
  message: RawMessage,
  root: RawConversation,
): string | null {
  const metadata = asRecord(message.metadata);
  return (
    stringOrNull(metadata.model_slug) ??
    stringOrNull(metadata.default_model_slug) ??
    stringOrNull(metadata.resolved_model_slug) ??
    root.default_model_slug
  );
}

function extractPartText(part: unknown): string {
  if (typeof part === "string") return part;
  if (!isRecord(part)) return "";

  return (
    stringOrNull(part.text) ??
    stringOrNull(part.content) ??
    stringOrNull(part.name) ??
    stringOrNull(part.asset_pointer) ??
    ""
  );
}

function extractAttachments(parts: unknown[]): AttachmentRef[] {
  return parts.flatMap((part) => {
    if (!isRecord(part)) return [];
    const assetPointer = stringOrNull(part.asset_pointer);
    const url =
      stringOrNull(part.url) ?? stringOrNull(asRecord(part.image_url).url);
    const mimeType = stringOrNull(part.mime_type);
    const name = stringOrNull(part.name);
    const type = stringOrNull(part.content_type) ?? stringOrNull(part.type);

    if (!assetPointer && !url && !mimeType && !name) return [];

    return [
      {
        id: assetPointer,
        type,
        name,
        url,
        mime_type: mimeType,
        size: numberOrNull(part.size),
      },
    ];
  });
}

function fallbackExtractText(value: Record<string, unknown>): string {
  const prioritized = [
    value.text,
    value.result,
    value.summary,
    value.model_set_context,
  ]
    .map(stringOrNull)
    .find((text) => text && text.trim().length > 0);

  if (prioritized) return prioritized;

  if (Array.isArray(value.parts)) {
    return value.parts.map(extractPartText).filter(Boolean).join("\n\n");
  }

  return "";
}

function citationsFromReference(reference: unknown): Citation[] {
  const value = asRecord(reference);
  const nestedCitation = isRecord(value.citation) ? value.citation : value;
  const base = citationFromRecord(nestedCitation);
  const citations = hasCitationData(base) ? [base] : [];

  const item = asRecord(value.item);
  const itemCitation = citationFromRecord({
    ...item,
    type: value.type,
    matched_text: value.matched_text,
    alt: value.alt,
  });
  if (hasCitationData(itemCitation)) citations.push(itemCitation);

  for (const collectionName of ["items", "sources"]) {
    const collection = value[collectionName];
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      const entryCitation = citationFromRecord({
        ...asRecord(entry),
        type: value.type,
        matched_text: value.matched_text,
        alt: value.alt,
      });
      if (hasCitationData(entryCitation)) citations.push(entryCitation);
    }
  }

  return citations;
}

function citationFromRecord(value: Record<string, unknown>): Citation {
  return {
    type: stringOrNull(value.type),
    title: stringOrNull(value.title),
    url: stringOrNull(value.url),
    attribution: stringOrNull(value.attribution),
    snippet: stringOrNull(value.snippet),
    matched_text: stringOrNull(value.matched_text),
    alt: stringOrNull(value.alt),
    start_idx: numberOrNull(value.start_idx),
    end_idx: numberOrNull(value.end_idx),
  };
}

function hasCitationData(citation: Citation): boolean {
  return Boolean(
    citation.url || citation.title || citation.matched_text || citation.alt,
  );
}

function getNodeTime(node: MappingNode): number {
  const createTime = numberOrNull(node.message?.create_time) ?? 0;
  const updateTime = numberOrNull(node.message?.update_time) ?? 0;
  return Math.max(createTime, updateTime);
}

function summarizeRaw(mapping: Record<string, MappingNode>) {
  const nodes = Object.values(mapping);
  return {
    node_count: nodes.length,
    root_count: nodes.filter((node) => !node.parent).length,
    leaf_count: nodes.filter((node) => node.children.length === 0).length,
  };
}

function countBranches(mapping: Record<string, MappingNode>): number {
  return Object.values(mapping).filter((node) => node.children.length > 1)
    .length;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
