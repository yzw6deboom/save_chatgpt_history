export type ConversationSource = 'raw_json' | 'current_page' | 'share_link' | 'dom' | 'unknown';

export type ConversationRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

export type WarningCode =
  | 'MAPPING_MISSING'
  | 'CURRENT_NODE_MISSING'
  | 'CURRENT_NODE_NOT_FOUND'
  | 'NODE_MISSING'
  | 'CYCLE_DETECTED'
  | 'EMPTY_MESSAGE_FILTERED'
  | 'HIDDEN_MESSAGE_FILTERED'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'INVALID_TIMESTAMP'
  | 'CONTENT_EXTRACTION_FAILED';

export interface ParseOptions {
  source: ConversationSource;
  includeSystemMessages?: boolean;
  includeToolMessages?: boolean;
  includeHiddenMessages?: boolean;
  includeMetadata?: boolean;
  includeCitations?: boolean;
  includeTimestamps?: boolean;
  includeModel?: boolean;
  outputFormat?: 'markdown';
}

export interface ParseWarning {
  code: WarningCode;
  message: string;
  node_id?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface Citation {
  type: string | null;
  title: string | null;
  url: string | null;
  attribution: string | null;
  snippet: string | null;
  matched_text: string | null;
  alt: string | null;
  start_idx: number | null;
  end_idx: number | null;
}

export interface AttachmentRef {
  id: string | null;
  type: string | null;
  name: string | null;
  url: string | null;
  mime_type: string | null;
  size: number | null;
}

export interface ConversationMessage {
  id: string;
  node_id: string;
  parent_node_id: string | null;
  role: ConversationRole;
  author_name: string | null;
  content: string;
  content_type: string;
  created_at: string | null;
  updated_at: string | null;
  model: string | null;
  status: string | null;
  end_turn: boolean | null;
  citations: Citation[];
  attachments: AttachmentRef[];
  metadata?: Record<string, unknown>;
}

export interface RawSummary {
  node_count: number;
  root_count: number;
  leaf_count: number;
}

export interface ConversationResult {
  schema_version: '1.0';
  source: ConversationSource;
  conversation_id: string | null;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  default_model: string | null;
  current_node: string | null;
  message_count: number;
  branch_count?: number;
  warnings: ParseWarning[];
  messages: ConversationMessage[];
  raw_summary?: RawSummary;
}

export interface RawMessage {
  id?: unknown;
  author?: {
    role?: unknown;
    name?: unknown;
    metadata?: unknown;
  };
  create_time?: unknown;
  update_time?: unknown;
  content?: unknown;
  status?: unknown;
  end_turn?: unknown;
  metadata?: unknown;
  recipient?: unknown;
  channel?: unknown;
}

export interface MappingNode {
  id: string;
  message: RawMessage | null;
  parent: string | null;
  children: string[];
}

export interface RawConversation {
  title: string | null;
  create_time: unknown;
  update_time: unknown;
  conversation_id: string | null;
  default_model_slug: string | null;
  current_node: string | null;
  mapping: Record<string, MappingNode> | null;
}

export interface ExtractedContent {
  content_type: string;
  text: string;
  attachments: AttachmentRef[];
}
