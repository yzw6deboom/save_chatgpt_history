export interface DownloadMarkdownOptions {
  filename: string;
  content: string;
  saveAs?: boolean;
}

export interface DownloadMarkdownSuccess {
  ok: true;
  filename: string;
  downloadId?: number;
}

export interface DownloadMarkdownFailure {
  ok: false;
  filename: string;
  error: string;
}

export type DownloadMarkdownResult =
  | DownloadMarkdownSuccess
  | DownloadMarkdownFailure;

export interface CopyMarkdownSuccess {
  ok: true;
}

export interface CopyMarkdownFailure {
  ok: false;
  error: string;
}

export type CopyMarkdownResult = CopyMarkdownSuccess | CopyMarkdownFailure;

export async function downloadMarkdownFile({
  filename,
  content,
  saveAs = true,
}: DownloadMarkdownOptions): Promise<DownloadMarkdownResult> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    if (
      typeof chrome !== "undefined" &&
      typeof chrome.downloads?.download === "function"
    ) {
      const downloadId = await downloadWithChrome(url, filename, saveAs);
      return { ok: true, filename, downloadId };
    }

    downloadWithAnchor(url, filename);
    return { ok: true, filename };
  } catch (error) {
    return {
      ok: false,
      filename,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyMarkdownToClipboard(
  content: string,
): Promise<CopyMarkdownResult> {
  try {
    if (!navigator.clipboard?.writeText) {
      return {
        ok: false,
        error: "当前浏览器环境不支持剪贴板写入。",
      };
    }

    await navigator.clipboard.writeText(content);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadWithChrome(
  url: string,
  filename: string,
  saveAs: boolean,
): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs }, (downloadId) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (typeof downloadId !== "number") {
        reject(new Error("浏览器没有返回下载任务 ID。"));
        return;
      }

      resolve(downloadId);
    });
  });
}

function downloadWithAnchor(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
