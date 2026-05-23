import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RawJsonAdapter } from "../src/adapters";

const currentDir = dirname(fileURLToPath(import.meta.url));
const realChatGptJsonPath = resolve(currentDir, "../spec/design/file.json");
const realChatGptJsonText = readFileSync(realChatGptJsonPath, "utf8");

describe("RawJsonAdapter", () => {
  it("parses a real ChatGPT file.json selected by user", async () => {
    const adapter = new RawJsonAdapter();
    const file = new File([realChatGptJsonText], "file.json", {
      type: "application/json",
    });

    const result = await adapter.parseFile(file, {
      includeCitations: true,
      includeModel: true,
      includeTimestamps: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.source).toBe("raw_json");
    expect(result.result.title).toBe("AI开发与个人成长");
    expect(result.result.current_node).toBe("d41c1ac7-1ecc-4f42-bd29-348a66cec822");
    expect(result.result.message_count).toBeGreaterThan(0);
    expect(result.result.messages.at(-1)?.content).toContain("沉浸式翻译");
  });

  it("parses JSON text directly", () => {
    const adapter = new RawJsonAdapter();

    const result = adapter.parseText(realChatGptJsonText, {
      includeModel: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.messages.some((message) => message.model === "gpt-5-5")).toBe(true);
  });

  it("returns a clear error for non JSON files", async () => {
    const adapter = new RawJsonAdapter();
    const file = new File([realChatGptJsonText], "conversation.txt", {
      type: "text/plain",
    });

    const result = await adapter.parseFile(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(result.error.message).toContain(".json");
  });

  it("returns a clear error for empty files", async () => {
    const adapter = new RawJsonAdapter();
    const file = new File([""], "empty.json", { type: "application/json" });

    const result = await adapter.parseFile(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_FILE");
    expect(result.error.message).toContain("文件为空");
  });

  it("returns a clear error for invalid JSON", async () => {
    const adapter = new RawJsonAdapter();
    const file = new File(["{ invalid json"], "broken.json", {
      type: "application/json",
    });

    const result = await adapter.parseFile(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_JSON");
    expect(result.error.message).toContain("有效 JSON");
  });

  it("returns a clear error when mapping is missing", async () => {
    const adapter = new RawJsonAdapter();
    const file = new File([JSON.stringify({ title: "not chatgpt" })], "not-chatgpt.json", {
      type: "application/json",
    });

    const result = await adapter.parseFile(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MAPPING_MISSING");
    expect(result.error.message).toContain("mapping");
  });

  it("returns a clear error when parsed result has no visible messages", () => {
    const adapter = new RawJsonAdapter();
    const raw = {
      title: "empty chat",
      mapping: {
        root: {
          id: "root",
          message: null,
          parent: null,
          children: [],
        },
      },
      current_node: "root",
    };

    const result = adapter.parseRaw(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_RESULT");
    expect(result.error.message).toContain("可见对话消息");
  });

  it("returns a clear error when file is too large", async () => {
    const adapter = new RawJsonAdapter({ maxFileSizeBytes: 10 });
    const file = new File([realChatGptJsonText], "large.json", {
      type: "application/json",
    });

    const result = await adapter.parseFile(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FILE_TOO_LARGE");
    expect(result.error.message).toContain("文件过大");
    expect(result.error.details).toContain("超过限制");
  });
});
