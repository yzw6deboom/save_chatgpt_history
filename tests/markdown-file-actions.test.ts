import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyMarkdownToClipboard,
  downloadMarkdownFile,
} from "../src/utils/markdown-file-actions";

describe("markdown file actions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "chrome");
  });

  it("downloads Markdown through chrome.downloads and revokes Blob URL", async () => {
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test-url");
    const downloadMock = vi.fn(
      (
        _options: chrome.downloads.DownloadOptions,
        callback?: (downloadId?: number) => void,
      ) => {
        callback?.(123);
      },
    );

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        downloads: { download: downloadMock },
        runtime: { lastError: undefined },
      },
    });

    const result = await downloadMarkdownFile({
      filename: "chat.md",
      content: "# Chat",
    });

    expect(result).toEqual({ ok: true, filename: "chat.md", downloadId: 123 });
    expect(downloadMock).toHaveBeenCalledWith(
      { url: "blob:test-url", filename: "chat.md", saveAs: true },
      expect.any(Function),
    );
    expect(createSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-url");
  });

  it("returns a failure when chrome download fails and still revokes Blob URL", async () => {
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
    const downloadMock = vi.fn(
      (
        _options: chrome.downloads.DownloadOptions,
        callback?: (downloadId?: number) => void,
      ) => {
        callback?.();
      },
    );

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        downloads: { download: downloadMock },
        runtime: { lastError: { message: "download denied" } },
      },
    });

    const result = await downloadMarkdownFile({
      filename: "chat.md",
      content: "# Chat",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("download denied");
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-url");
  });

  it("copies Markdown to clipboard", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const result = await copyMarkdownToClipboard("# Chat");

    expect(result).toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith("# Chat");
  });

  it("returns a clear failure when clipboard write fails", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error("no permission"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const result = await copyMarkdownToClipboard("# Chat");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no permission");
  });
});
