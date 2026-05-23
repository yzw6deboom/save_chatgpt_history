import { parseConversation } from '../core/parser';
import type { ConversationResult, ParseOptions } from '../core/types';

export type RawJsonAdapterErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INVALID_JSON'
  | 'MAPPING_MISSING'
  | 'EMPTY_RESULT'
  | 'FILE_READ_FAILED';

export interface RawJsonAdapterOptions {
  maxFileSizeBytes?: number;
}

export interface RawJsonAdapterSuccess {
  ok: true;
  result: ConversationResult;
}

export interface RawJsonAdapterFailure {
  ok: false;
  error: RawJsonAdapterError;
}

export interface RawJsonAdapterError {
  code: RawJsonAdapterErrorCode;
  message: string;
  details?: string;
}

export type RawJsonAdapterResult = RawJsonAdapterSuccess | RawJsonAdapterFailure;

const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ERROR_MESSAGES: Record<RawJsonAdapterErrorCode, string> = {
  EMPTY_FILE: '文件为空，请选择包含 ChatGPT 对话 JSON 的文件。',
  FILE_TOO_LARGE: '文件过大，请选择更小的 ChatGPT 对话 JSON 文件。',
  UNSUPPORTED_FILE_TYPE: '请选择 .json 格式的文件。',
  INVALID_JSON: '文件不是有效 JSON，请检查文件内容。',
  MAPPING_MISSING: '该 JSON 不包含 ChatGPT 对话树字段 `mapping`。',
  EMPTY_RESULT: '未能从该 JSON 中解析出可见对话消息。',
  FILE_READ_FAILED: '读取文件失败，请重新选择文件后再试。',
};

export class RawJsonAdapter {
  private readonly maxFileSizeBytes: number;

  constructor(options: RawJsonAdapterOptions = {}) {
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  async parseFile(
    file: File,
    parseOptions: Partial<ParseOptions> = {},
  ): Promise<RawJsonAdapterResult> {
    if (file.size === 0) {
      return adapterError('EMPTY_FILE');
    }

    if (file.size > this.maxFileSizeBytes) {
      return adapterError(
        'FILE_TOO_LARGE',
        `文件大小 ${formatBytes(file.size)}，超过限制 ${formatBytes(this.maxFileSizeBytes)}。`,
      );
    }

    if (!isJsonFile(file)) {
      return adapterError(
        'UNSUPPORTED_FILE_TYPE',
        `当前文件名：${file.name || '未知文件名'}；MIME 类型：${file.type || '未知类型'}。`,
      );
    }

    try {
      const text = await file.text();
      return this.parseText(text, parseOptions);
    } catch (error) {
      return adapterError('FILE_READ_FAILED', error instanceof Error ? error.message : String(error));
    }
  }

  parseText(text: string, parseOptions: Partial<ParseOptions> = {}): RawJsonAdapterResult {
    if (!text.trim()) {
      return adapterError('EMPTY_FILE');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch (error) {
      return adapterError('INVALID_JSON', error instanceof Error ? error.message : String(error));
    }

    return this.parseRaw(raw, parseOptions);
  }

  parseRaw(raw: unknown, parseOptions: Partial<ParseOptions> = {}): RawJsonAdapterResult {
    if (!hasMapping(raw)) {
      return adapterError('MAPPING_MISSING');
    }

    const result = parseConversation(raw, {
      source: 'raw_json',
      ...parseOptions,
    });

    if (result.message_count === 0) {
      return adapterError('EMPTY_RESULT');
    }

    return {
      ok: true,
      result,
    };
  }
}

export function createRawJsonAdapter(options?: RawJsonAdapterOptions): RawJsonAdapter {
  return new RawJsonAdapter(options);
}

function adapterError(code: RawJsonAdapterErrorCode, details?: string): RawJsonAdapterFailure {
  return {
    ok: false,
    error: {
      code,
      message: ERROR_MESSAGES[code],
      ...(details ? { details } : {}),
    },
  };
}

function isJsonFile(file: File): boolean {
  const lowerCaseName = file.name.toLowerCase();
  const lowerCaseType = file.type.toLowerCase();

  return (
    lowerCaseName.endsWith('.json') ||
    lowerCaseType === 'application/json' ||
    lowerCaseType === 'text/json'
  );
}

function hasMapping(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isRecord(value.mapping);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
