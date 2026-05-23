import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildExportFilename,
  parseConversation,
  sanitizeFilename,
  toMarkdown,
} from "../src/core";
import type { ConversationResult } from "../src/core";

const currentDir = dirname(fileURLToPath(import.meta.url));
const realChatGptJsonPath = resolve(currentDir, "../spec/design/file.json");
const markdownOutputDir = resolve(currentDir, "../.output/markdown-exporter");
const markdownOutputPath = resolve(markdownOutputDir, "spec-design-file.md");

const conversation: ConversationResult = {
  schema_version: "1.0",
  source: "raw_json",
  conversation_id: "conversation-1",
  title: "测试标题",
  created_at: "2026-05-17T06:56:31.967Z",
  updated_at: "2026-05-17T07:00:00.000Z",
  default_model: "gpt-5-5",
  current_node: "node-2",
  message_count: 2,
  warnings: [],
  messages: [
    {
      id: "message-1",
      node_id: "node-1",
      parent_node_id: null,
      role: "user",
      author_name: null,
      content: "请推荐一个翻译插件。",
      content_type: "text",
      created_at: "2026-05-17T06:56:00.000Z",
      updated_at: null,
      model: null,
      status: "finished_successfully",
      end_turn: true,
      citations: [],
      attachments: [],
    },
    {
      id: "message-2",
      node_id: "node-2",
      parent_node_id: "node-1",
      role: "assistant",
      author_name: null,
      content: "推荐使用 [沉浸式翻译](https://immersivetranslate.com)。",
      content_type: "text",
      created_at: "2026-05-17T06:56:31.967Z",
      updated_at: null,
      model: "gpt-5-5",
      status: "finished_successfully",
      end_turn: true,
      citations: [
        {
          type: "url",
          title: "沉浸式翻译",
          url: "https://immersivetranslate.com",
          attribution: "immersivetranslate.com",
          snippet: "A bilingual webpage translation extension.",
          matched_text: null,
          alt: null,
          start_idx: null,
          end_idx: null,
        },
      ],
      attachments: [],
    },
  ],
};

describe("markdown exporter", () => {
  it("exports readable standard Markdown with metadata, message headings, model, time, and citations", () => {
    const markdown = toMarkdown(conversation);

    expect(markdown).toContain("# 测试标题");
    expect(markdown).toContain("- Conversation ID: conversation-1");
    expect(markdown).toContain("- Created At: 2026-05-17T06:56:31.967Z");
    expect(markdown).toContain("- Default Model: gpt-5-5");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("请推荐一个翻译插件。");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("- Model: gpt-5-5");
    expect(markdown).toContain("### Citations");
    expect(markdown).toContain("[沉浸式翻译](https://immersivetranslate.com)");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("replaces ChatGPT private marker symbols with spaces", () => {
    const markdown = toMarkdown({
      ...conversation,
      messages: [
        {
          ...conversation.messages[1]!,
          content: "A url沉浸式翻译https://immersivetranslate.com B",
          citations: [
            {
              type: "url",
              title: "citation title",
              url: "https://example.com",
              attribution: "example.com",
              snippet: "snippet with  marker",
              matched_text: null,
              alt: null,
              start_idx: null,
              end_idx: null,
            },
          ],
        },
      ],
      message_count: 1,
    });

    expect(markdown).not.toMatch(/[\uE000-\uF8FF]/);
    expect(markdown).toContain(
      "A  url 沉浸式翻译 https://immersivetranslate.com  B",
    );
    expect(markdown).toContain("[ citation title ](https://example.com)");
    expect(markdown).toContain("snippet with   marker");
  });

  it("respects Markdown export options", () => {
    const markdown = toMarkdown(conversation, {
      includeCitations: false,
      includeMetadata: false,
      includeModel: false,
      includeTimestamps: false,
    });

    expect(markdown).toContain("# 测试标题");
    expect(markdown).not.toContain("Conversation ID");
    expect(markdown).not.toContain("Created At");
    expect(markdown).not.toContain("Model:");
    expect(markdown).not.toContain("### Citations");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("## Assistant");
  });

  it("sanitizes filenames and preserves Chinese titles", () => {
    expect(sanitizeFilename("AI开发与个人成长")).toBe("AI开发与个人成长");
    expect(sanitizeFilename("  bad / name: with * chars?  ")).toBe(
      "bad name with chars",
    );
    expect(sanitizeFilename("...")).toBe("untitled-conversation");
    expect(sanitizeFilename("")).toBe("untitled-conversation");
    expect(sanitizeFilename("CON")).toBe("CON-conversation");
  });

  it("builds a .md export filename and handles long titles", () => {
    const filename = buildExportFilename({ title: "AI开发与个人成长" });
    const longFilename = buildExportFilename({ title: "很长".repeat(100) });

    expect(filename).toBe("AI开发与个人成长.md");
    expect(longFilename.endsWith(".md")).toBe(true);
    expect(longFilename.length).toBeLessThanOrEqual(123);
  });

  it("exports spec/design/file.json to Markdown for manual inspection", () => {
    const raw = JSON.parse(
      readFileSync(realChatGptJsonPath, "utf8"),
    ) as unknown;
    const result = parseConversation(raw, {
      source: "raw_json",
      includeCitations: true,
      includeModel: true,
      includeTimestamps: true,
    });
    const markdown = toMarkdown(result);

    mkdirSync(markdownOutputDir, { recursive: true });
    writeFileSync(markdownOutputPath, markdown, "utf8");

    console.info("Markdown output written:", markdownOutputPath);
    console.info("Markdown output summary:", {
      filename: buildExportFilename(result),
      title: result.title,
      message_count: result.message_count,
      output_file: markdownOutputPath,
    });

    expect(markdown).toContain("# AI开发与个人成长");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("沉浸式翻译");
    expect(markdown).not.toMatch(/[\uE000-\uF8FF]/);
  });
});
