import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../assets/styles.css";
import { RawJsonAdapter } from "../../adapters";
import type { ConversationResult } from "../../core";

type PopupStatus = "idle" | "parsing" | "success" | "error";

function PopupApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<PopupStatus>("idle");
  const [message, setMessage] = useState(
    "可从这里打开侧边栏，或快速导入 JSON 验证文件。",
  );
  const [result, setResult] = useState<ConversationResult | null>(null);

  async function openSidePanel() {
    try {
      await chrome.sidePanel?.open?.({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });
      window.close();
    } catch {
      setStatus("error");
      setMessage("无法打开 Side Panel，请确认当前浏览器支持侧边栏。");
    }
  }

  async function openOptionsPage() {
    await chrome.runtime.openOptionsPage();
  }

  async function parsePopupFile(file: File | null) {
    if (!file) return;

    setStatus("parsing");
    setMessage("正在解析 JSON…");
    setResult(null);

    const adapter = new RawJsonAdapter();
    const parseResult = await adapter.parseFile(file, {
      includeCitations: true,
      includeModel: true,
      includeTimestamps: true,
    });

    if (!parseResult.ok) {
      setStatus("error");
      setMessage(parseResult.error.message);
      return;
    }

    setStatus("success");
    setResult(parseResult.result);
    setMessage(
      `解析成功：${parseResult.result.title}，共 ${parseResult.result.message_count} 条消息。`,
    );
  }

  return (
    <main className="w-80 space-y-4 p-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Save ChatGPT History
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-950">
          ChatGPT Markdown Exporter
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          导入 ChatGPT JSON，解析后在侧边栏预览并导出 Markdown。
        </p>
      </section>

      <div className="grid gap-2">
        <button
          type="button"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          onClick={() => void openSidePanel()}
        >
          打开 Side Panel
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) =>
            void parsePopupFile(event.target.files?.[0] ?? null)
          }
        />
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "parsing"}
        >
          {status === "parsing" ? "解析中…" : "导入 JSON"}
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => void openOptionsPage()}
        >
          打开设置
        </button>
      </div>

      <section
        className={`rounded-lg p-3 text-sm ${status === "error" ? "bg-red-50 text-red-700" : status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
      >
        <p>{message}</p>
        {result ? (
          <p className="mt-1 text-xs">
            当前节点：{result.current_node ?? "N/A"}
          </p>
        ) : null}
      </section>
    </main>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <PopupApp />
    </React.StrictMode>,
  );
}
