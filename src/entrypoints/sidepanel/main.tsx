import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../assets/styles.css";
import { RawJsonAdapter } from "../../adapters";
import {
  buildExportFilename,
  toMarkdown,
  type ConversationResult,
  type ParseWarning,
} from "../../core";
import {
  DEFAULT_EXPORT_SETTINGS,
  loadExportSettings,
  saveExportSettings,
  type ExportSettings,
} from "../../storage/export-settings";
import {
  copyMarkdownToClipboard,
  downloadMarkdownFile,
} from "../../utils/markdown-file-actions";

type ParseStatus = "idle" | "ready" | "parsing" | "success" | "error";

interface UiError {
  title: string;
  message: string;
  details?: string;
}

function SidePanelApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ParseStatus>("idle");
  const [result, setResult] = useState<ConversationResult | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [settings, setSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS,
  );
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void loadExportSettings().then(setSettings);
  }, []);

  const markdown = useMemo(() => {
    if (!result) return "";
    return toMarkdown(result, settings);
  }, [result, settings]);

  const canExport = Boolean(result && status === "success");

  function selectFile(file: File | null) {
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setCopyStatus(null);
    setDownloadStatus(null);
    setStatus(file ? "ready" : "idle");
  }

  async function parseSelectedFile() {
    if (!selectedFile) {
      setError({
        title: "请选择 JSON 文件",
        message: "请先选择或拖拽一个 ChatGPT 原始 JSON 文件。",
      });
      setStatus("error");
      return;
    }

    setStatus("parsing");
    setError(null);
    setCopyStatus(null);
    setDownloadStatus(null);

    const adapter = new RawJsonAdapter();
    const parseResult = await adapter.parseFile(selectedFile, {
      includeCitations: true,
      includeMetadata: settings.includeMetadata,
      includeModel: settings.includeModel,
      includeTimestamps: settings.includeTimestamps,
    });

    if (!parseResult.ok) {
      setResult(null);
      setStatus("error");
      setError({
        title: "解析失败",
        message: parseResult.error.message,
        ...(parseResult.error.details
          ? { details: parseResult.error.details }
          : {}),
      });
      return;
    }

    setResult(parseResult.result);
    setStatus("success");
  }

  async function updateSetting(key: keyof ExportSettings, value: boolean) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    await saveExportSettings(nextSettings);
  }

  async function copyMarkdown() {
    if (!markdown) return;

    const copyResult = await copyMarkdownToClipboard(markdown);
    setCopyStatus(
      copyResult.ok
        ? "Markdown 已复制到剪贴板。"
        : `复制失败：${copyResult.error} 请手动选择下方 Markdown 内容复制。`,
    );
  }

  async function downloadMarkdown() {
    if (!result || !markdown) return;

    const filename = buildExportFilename(result);
    const downloadResult = await downloadMarkdownFile({
      filename,
      content: markdown,
      saveAs: true,
    });

    if (downloadResult.ok) {
      setDownloadStatus(`已生成下载文件：${filename}`);
      return;
    }

    const copyResult = await copyMarkdownToClipboard(markdown);
    setDownloadStatus(
      copyResult.ok
        ? `下载失败：${downloadResult.error} 已自动复制 Markdown，可手动保存为 ${filename}。`
        : `下载失败：${downloadResult.error} 自动复制也失败：${copyResult.error}。请手动选择下方 Markdown 内容复制。`,
    );
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files.item(0));
  }

  return (
    <main className="min-h-screen space-y-5 p-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Save ChatGPT History
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          ChatGPT to Markdown
        </h1>
        <p className="text-sm text-slate-600">
          导入 ChatGPT 原始 JSON，在本地解析、预览并导出标准 Markdown。
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">1. 导入 JSON</h2>
        <div
          className={`mt-3 rounded-xl border border-dashed p-6 text-center transition ${isDragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <p className="text-sm font-medium text-slate-800">
            拖拽 ChatGPT JSON 文件到这里
          </p>
          <p className="mt-1 text-xs text-slate-500">
            或选择本地 `.json` 文件，所有解析都在浏览器本地完成。
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={() => fileInputRef.current?.click()}
            >
              选择 JSON 文件
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => void parseSelectedFile()}
              disabled={status === "parsing"}
            >
              {status === "parsing" ? "解析中…" : "解析文件"}
            </button>
          </div>
          {selectedFile ? (
            <p className="mt-3 text-xs text-slate-600">
              已选择：{selectedFile.name}
            </p>
          ) : null}
        </div>
      </section>

      <StatusCard status={status} result={result} error={error} />

      {result ? (
        <>
          <WarningsCard warnings={result.warnings} />
          <ExportSettingsCard
            settings={settings}
            onChange={(key, value) => void updateSetting(key, value)}
          />
          <PreviewCard result={result} />
          <ExportActionsCard
            canExport={canExport}
            markdown={markdown}
            copyStatus={copyStatus}
            downloadStatus={downloadStatus}
            onCopy={() => void copyMarkdown()}
            onDownload={() => void downloadMarkdown()}
          />
        </>
      ) : null}
    </main>
  );
}

function StatusCard({
  status,
  result,
  error,
}: {
  status: ParseStatus;
  result: ConversationResult | null;
  error: UiError | null;
}) {
  const statusText = {
    idle: "等待导入 JSON 文件。",
    ready: "文件已选择，点击“解析文件”开始。",
    parsing: "正在解析 JSON，请稍候…",
    success: result
      ? `解析成功：${result.title}，共 ${result.message_count} 条可见消息。`
      : "解析成功。",
    error: error?.message ?? "解析失败。",
  }[status];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">2. 解析状态</h2>
      <p
        className={`mt-2 text-sm ${status === "error" ? "text-red-600" : "text-slate-700"}`}
      >
        {statusText}
      </p>
      {error?.details ? (
        <p className="mt-1 text-xs text-slate-500">{error.details}</p>
      ) : null}
    </section>
  );
}

function WarningsCard({ warnings }: { warnings: ParseWarning[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Warnings</h2>
      {warnings.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">没有解析 warning。</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-2 overflow-auto text-sm">
          {warnings.map((warning, index) => (
            <li
              key={`${warning.code}-${warning.node_id ?? "root"}-${index}`}
              className="rounded-lg bg-amber-50 p-3 text-amber-900"
            >
              <p className="font-medium">{warning.code}</p>
              <p className="mt-1 text-xs">{warning.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExportSettingsCard({
  settings,
  onChange,
}: {
  settings: ExportSettings;
  onChange: (key: keyof ExportSettings, value: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Markdown 导出设置
      </h2>
      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <Checkbox
          label="包含时间"
          checked={settings.includeTimestamps}
          onChange={(checked) => onChange("includeTimestamps", checked)}
        />
        <Checkbox
          label="包含模型"
          checked={settings.includeModel}
          onChange={(checked) => onChange("includeModel", checked)}
        />
        <Checkbox
          label="包含引用"
          checked={settings.includeCitations}
          onChange={(checked) => onChange("includeCitations", checked)}
        />
        <Checkbox
          label="包含基础 metadata"
          checked={settings.includeMetadata}
          onChange={(checked) => onChange("includeMetadata", checked)}
        />
      </div>
    </section>
  );
}

function PreviewCard({ result }: { result: ConversationResult }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">消息预览</h2>
      <div className="mt-3 max-h-[28rem] space-y-3 overflow-auto">
        {result.messages.map((message, index) => (
          <article
            key={message.id}
            className="rounded-xl border border-slate-200 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {index + 1}.{" "}
                {message.role === "assistant" ? "Assistant" : "User"}
              </h3>
              {message.model ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {message.model}
                </span>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {truncateText(message.content, 1200)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExportActionsCard({
  canExport,
  markdown,
  copyStatus,
  downloadStatus,
  onCopy,
  onDownload,
}: {
  canExport: boolean;
  markdown: string;
  copyStatus: string | null;
  downloadStatus: string | null;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">导出 Markdown</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canExport}
          onClick={onDownload}
        >
          下载 .md 文件
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
          disabled={!canExport}
          onClick={onCopy}
        >
          复制 Markdown
        </button>
      </div>
      {downloadStatus ? (
        <p className="mt-2 text-xs text-slate-600">{downloadStatus}</p>
      ) : null}
      {copyStatus ? (
        <p className="mt-2 text-xs text-slate-600">{copyStatus}</p>
      ) : null}
      <textarea
        className="mt-3 h-36 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
        readOnly
        value={markdown}
        placeholder="解析成功后会生成 Markdown 预览。"
      />
    </section>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span>{label}</span>
    </label>
  );
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n…（已截断，仅预览前 ${maxLength} 字）`;
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>,
  );
}
