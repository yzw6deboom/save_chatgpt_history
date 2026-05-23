import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXPORT_SETTINGS,
  loadExportSettings,
  saveExportSettings,
} from "../src/storage/export-settings";

function installChromeStorageMock(initial: Record<string, unknown> = {}) {
  const store = { ...initial };

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: vi.fn(
            (
              key: string,
              callback: (items: Record<string, unknown>) => void,
            ) => {
              callback({ [key]: store[key] });
            },
          ),
          set: vi.fn(
            (items: Record<string, unknown>, callback?: () => void) => {
              Object.assign(store, items);
              callback?.();
            },
          ),
        },
      },
    },
  });

  return store;
}

describe("export settings storage", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "chrome");
    vi.restoreAllMocks();
  });

  it("returns defaults when no settings are saved", async () => {
    installChromeStorageMock();

    await expect(loadExportSettings()).resolves.toEqual(
      DEFAULT_EXPORT_SETTINGS,
    );
  });

  it("persists settings across reloads with chrome.storage.local", async () => {
    installChromeStorageMock();
    const settings = {
      includeTimestamps: false,
      includeModel: false,
      includeCitations: true,
      includeMetadata: false,
    };

    await saveExportSettings(settings);

    await expect(loadExportSettings()).resolves.toEqual(settings);
  });

  it("merges partial stored settings with defaults", async () => {
    installChromeStorageMock({ exportSettings: { includeModel: false } });

    await expect(loadExportSettings()).resolves.toEqual({
      ...DEFAULT_EXPORT_SETTINGS,
      includeModel: false,
    });
  });
});
