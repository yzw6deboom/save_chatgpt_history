import type {
  Citation,
  ConversationMessage,
  ConversationResult,
} from "../types";

export interface MarkdownExportOptions {
  includeTimestamps?: boolean;
  includeModel?: boolean;
  includeCitations?: boolean;
  includeMetadata?: boolean;
}

const DEFAULT_MARKDOWN_OPTIONS: Required<MarkdownExportOptions> = {
  includeTimestamps: true,
  includeModel: true,
  includeCitations: true,
  includeMetadata: true,
};

const DEFAULT_FILENAME = "untitled-conversation";
const MAX_FILENAME_LENGTH = 120;
const RESERVED_WINDOWS_FILENAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export function toMarkdown(
  conversation: ConversationResult,
  options: MarkdownExportOptions = {},
): string {
  const resolvedOptions = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
  const lines: string[] = [];

  lines.push(`# ${formatHeadingText(conversation.title)}`);
  lines.push("");

  if (resolvedOptions.includeMetadata) {
    lines.push(...renderConversationMetadata(conversation, resolvedOptions));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  conversation.messages.forEach((message, index) => {
    if (index > 0) lines.push("");
    lines.push(...renderMessage(message, resolvedOptions));
  });

  return `${sanitizeMarkdownText(lines.join("\n"))
    .replace(/[ \t]+$/gm, "")
    .trimEnd()}\n`;
}

export function sanitizeFilename(title: string | null | undefined): string {
  const withoutIllegalCharacters = (title ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");

  const normalized = withoutIllegalCharacters || DEFAULT_FILENAME;
  const safeReservedName = RESERVED_WINDOWS_FILENAMES.has(
    normalized.toUpperCase(),
  )
    ? `${normalized}-conversation`
    : normalized;

  return (
    trimFilename(safeReservedName, MAX_FILENAME_LENGTH) || DEFAULT_FILENAME
  );
}

export function buildExportFilename(
  conversation: Pick<ConversationResult, "title">,
): string {
  return `${sanitizeFilename(conversation.title)}.md`;
}

function renderConversationMetadata(
  conversation: ConversationResult,
  options: Required<MarkdownExportOptions>,
): string[] {
  const metadata = [
    ["Conversation ID", conversation.conversation_id ?? "N/A"],
    ...(options.includeTimestamps
      ? [
          ["Created At", conversation.created_at ?? "N/A"],
          ["Updated At", conversation.updated_at ?? "N/A"],
        ]
      : []),
    ["Message Count", String(conversation.message_count)],
    ["Source", conversation.source],
    ...(options.includeModel
      ? [["Default Model", conversation.default_model ?? "N/A"]]
      : []),
  ];

  return metadata.map(([label, value]) => `- ${label}: ${value}`);
}

function renderMessage(
  message: ConversationMessage,
  options: Required<MarkdownExportOptions>,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${formatRole(message.role)}`);
  lines.push("");

  const details = renderMessageDetails(message, options);
  if (details.length > 0) {
    lines.push(...details);
    lines.push("");
  }

  lines.push(message.content.trimEnd());

  if (options.includeCitations && message.citations.length > 0) {
    lines.push("");
    lines.push("### Citations");
    lines.push("");
    lines.push(...renderCitations(message.citations));
  }

  return lines;
}

function renderMessageDetails(
  message: ConversationMessage,
  options: Required<MarkdownExportOptions>,
): string[] {
  const details: string[] = [];

  if (options.includeTimestamps && message.created_at) {
    details.push(`- Created At: ${message.created_at}`);
  }

  if (options.includeModel && message.model) {
    details.push(`- Model: ${message.model}`);
  }

  return details;
}

function renderCitations(citations: Citation[]): string[] {
  return citations.map((citation, index) => {
    const title =
      citation.title ||
      citation.attribution ||
      citation.url ||
      citation.alt ||
      `Citation ${index + 1}`;
    const prefix = `${index + 1}.`;
    const link = citation.url
      ? `[${escapeLinkText(title)}](${citation.url})`
      : title;
    const suffixParts = [citation.attribution, citation.snippet].filter(
      (part): part is string => Boolean(part && part.trim().length > 0),
    );
    const suffix =
      suffixParts.length > 0 ? ` — ${suffixParts.join(" — ")}` : "";

    return `${prefix} ${link}${suffix}`;
  });
}

function sanitizeMarkdownText(value: string): string {
  return value.replace(/[\uE000-\uF8FF]/g, " ");
}

function formatRole(role: ConversationMessage["role"]): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
    case "tool":
      return "Tool";
    default:
      return "Unknown";
  }
}

function formatHeadingText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim() || "Untitled Conversation";
}

function escapeLinkText(value: string): string {
  return value.replace(/]/g, "\\]");
}

function trimFilename(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const trimmed = Array.from(value)
    .slice(0, maxLength)
    .join("")
    .trim()
    .replace(/[. ]+$/g, "");
  return trimmed;
}
