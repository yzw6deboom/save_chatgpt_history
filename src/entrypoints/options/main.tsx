import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../assets/styles.css";
import {
  DEFAULT_EXPORT_SETTINGS,
  loadExportSettings,
  saveExportSettings,
  type ExportSettings,
} from "../../storage/export-settings";

function OptionsApp() {
  const [settings, setSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS,
  );
  const [status, setStatus] = useState("设置会自动保存到浏览器本地。");

  useEffect(() => {
    void loadExportSettings().then(setSettings);
  }, []);

  async function updateSetting(key: keyof ExportSettings, value: boolean) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    await saveExportSettings(nextSettings);
    setStatus("设置已保存。");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Options
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">
          Save ChatGPT History
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          配置 Markdown 导出的默认选项。这些设置会在 Side Panel 中自动加载。
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Markdown 导出设置
        </h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700">
          <Checkbox
            label="包含时间"
            description="在对话 metadata 和消息详情中输出 ISO 时间。"
            checked={settings.includeTimestamps}
            onChange={(checked) =>
              void updateSetting("includeTimestamps", checked)
            }
          />
          <Checkbox
            label="包含模型"
            description="输出默认模型和每条消息的模型字段。"
            checked={settings.includeModel}
            onChange={(checked) => void updateSetting("includeModel", checked)}
          />
          <Checkbox
            label="包含引用"
            description="输出 assistant 消息中的 citations 列表。"
            checked={settings.includeCitations}
            onChange={(checked) =>
              void updateSetting("includeCitations", checked)
            }
          />
          <Checkbox
            label="包含基础 metadata"
            description="输出 Conversation ID、消息数、来源等基础信息。"
            checked={settings.includeMetadata}
            onChange={(checked) =>
              void updateSetting("includeMetadata", checked)
            }
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">{status}</p>
      </section>
    </main>
  );
}

function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <span>
        <span className="block font-medium text-slate-900">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );
}
