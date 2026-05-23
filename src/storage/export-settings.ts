import type { MarkdownExportOptions } from '../core';

export interface ExportSettings extends Required<MarkdownExportOptions> {}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  includeTimestamps: true,
  includeModel: true,
  includeCitations: true,
  includeMetadata: true,
};

const STORAGE_KEY = 'exportSettings';

export async function loadExportSettings(): Promise<ExportSettings> {
  const stored = await readStorageValue(STORAGE_KEY);
  if (!isRecord(stored)) return DEFAULT_EXPORT_SETTINGS;

  return {
    includeTimestamps: typeof stored.includeTimestamps === 'boolean'
      ? stored.includeTimestamps
      : DEFAULT_EXPORT_SETTINGS.includeTimestamps,
    includeModel: typeof stored.includeModel === 'boolean'
      ? stored.includeModel
      : DEFAULT_EXPORT_SETTINGS.includeModel,
    includeCitations: typeof stored.includeCitations === 'boolean'
      ? stored.includeCitations
      : DEFAULT_EXPORT_SETTINGS.includeCitations,
    includeMetadata: typeof stored.includeMetadata === 'boolean'
      ? stored.includeMetadata
      : DEFAULT_EXPORT_SETTINGS.includeMetadata,
  };
}

export async function saveExportSettings(settings: ExportSettings): Promise<void> {
  await writeStorageValue(STORAGE_KEY, settings);
}

async function readStorageValue(key: string): Promise<unknown> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (items) => {
        resolve(items[key]);
      });
    });
  }

  const raw = globalThis.localStorage?.getItem(key);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function writeStorageValue(key: string, value: unknown): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
    return;
  }

  globalThis.localStorage?.setItem(key, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
