import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractContent,
  inferLatestLeafNode,
  parseConversation,
  resolveCurrentPath,
  shouldKeepMessage,
  toIsoTime,
} from "../src/core";
import type {
  ConversationMessage,
  MappingNode,
  ParseWarning,
} from "../src/core";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
  currentDir,
  "fixtures/chatgpt-conversation-sample.json",
);
const realChatGptJsonPath = resolve(currentDir, "../spec/design/file.json");
const parserOutputDir = resolve(currentDir, "../.output/parser-core");
const parserOutputPath = resolve(
  parserOutputDir,
  "spec-design-file.parsed.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;

function readRealChatGptJson(): unknown {
  return JSON.parse(readFileSync(realChatGptJsonPath, "utf8")) as unknown;
}

const baseMessage: ConversationMessage = {
  id: "message-1",
  node_id: "node-1",
  parent_node_id: null,
  role: "user",
  author_name: null,
  content: "hello",
  content_type: "text",
  created_at: null,
  updated_at: null,
  model: null,
  status: null,
  end_turn: null,
  citations: [],
  attachments: [],
};

describe("parser core", () => {
  it("parses the ChatGPT fixture into the current main trunk", () => {
    const result = parseConversation(fixture, {
      source: "raw_json",
      includeCitations: true,
      includeModel: true,
    });

    expect(result.schema_version).toBe("1.0");
    expect(result.source).toBe("raw_json");
    expect(result.current_node).toBe("d41c1ac7-1ecc-4f42-bd29-348a66cec822");
    expect(result.message_count).toBeGreaterThan(0);
    expect(
      result.messages.every(
        (message) => message.role === "user" || message.role === "assistant",
      ),
    ).toBe(true);
    expect(result.messages.at(-1)?.content).toContain("沉浸式翻译");
    expect(result.messages.at(-1)?.citations.length).toBeGreaterThan(0);
    expect(result.messages.some((message) => message.model === "gpt-5-5")).toBe(
      true,
    );
  });

  it("parses spec/design/file.json as a real ChatGPT page JSON", () => {
    const realChatGptJson = readRealChatGptJson();

    const result = parseConversation(realChatGptJson, {
      source: "raw_json",
      includeCitations: true,
      includeModel: true,
    });

    expect(result.schema_version).toBe("1.0");
    expect(result.source).toBe("raw_json");
    expect(result.current_node).toBe("d41c1ac7-1ecc-4f42-bd29-348a66cec822");
    expect(result.raw_summary?.node_count).toBeGreaterThan(0);
    expect(result.message_count).toBeGreaterThan(0);
    expect(
      result.warnings.some((warning) => warning.severity === "error"),
    ).toBe(false);
    expect(
      result.messages.every(
        (message) => message.role === "user" || message.role === "assistant",
      ),
    ).toBe(true);
    expect(result.messages.at(-1)?.role).toBe("assistant");
    expect(result.messages.at(-1)?.content).toContain("沉浸式翻译");
    expect(result.messages.at(-1)?.citations.length).toBeGreaterThan(0);
    expect(result.messages.some((message) => message.model === "gpt-5-5")).toBe(
      true,
    );
  });

  it("writes parsed spec/design/file.json output for manual inspection", () => {
    const realChatGptJson = readRealChatGptJson();
    const result = parseConversation(realChatGptJson, {
      source: "raw_json",
      includeCitations: true,
      includeMetadata: true,
      includeModel: true,
      includeTimestamps: true,
    });

    mkdirSync(parserOutputDir, { recursive: true });
    writeFileSync(
      parserOutputPath,
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );

    console.info("Parser output written:", parserOutputPath);
    console.info("Parser output summary:", {
      title: result.title,
      current_node: result.current_node,
      message_count: result.message_count,
      warning_count: result.warnings.length,
      output_file: parserOutputPath,
    });

    expect(result.message_count).toBeGreaterThan(0);
  });

  it("infers the latest leaf node when current_node is missing", () => {
    const warnings: ParseWarning[] = [];
    const mapping: Record<string, MappingNode> = {
      root: {
        id: "root",
        message: null,
        parent: null,
        children: ["old", "new"],
      },
      old: {
        id: "old",
        message: { create_time: 1000 },
        parent: "root",
        children: [],
      },
      new: {
        id: "new",
        message: { create_time: 2000 },
        parent: "root",
        children: [],
      },
    };

    expect(inferLatestLeafNode(mapping, warnings)).toBe("new");
    expect(
      warnings.some((warning) => warning.code === "CURRENT_NODE_MISSING"),
    ).toBe(true);
  });

  it("parses multi-branch conversations by following current_node branch", () => {
    const result = parseConversation(
      {
        title: "branching",
        mapping: {
          root: {
            id: "root",
            message: null,
            parent: null,
            children: ["a", "b"],
          },
          a: {
            id: "a",
            parent: "root",
            children: [],
            message: {
              id: "a",
              author: { role: "assistant" },
              content: { content_type: "text", parts: ["old branch"] },
            },
          },
          b: {
            id: "b",
            parent: "root",
            children: [],
            message: {
              id: "b",
              author: { role: "assistant" },
              content: { content_type: "text", parts: ["selected branch"] },
            },
          },
        },
        current_node: "b",
      },
      { source: "raw_json" },
    );

    expect(result.message_count).toBe(1);
    expect(result.branch_count).toBe(1);
    expect(result.messages[0]?.content).toBe("selected branch");
  });

  it("resolves a path from current node to root and reports missing parents", () => {
    const warnings: ParseWarning[] = [];
    const mapping: Record<string, MappingNode> = {
      root: { id: "root", message: null, parent: null, children: ["a"] },
      a: { id: "a", message: null, parent: "root", children: ["b"] },
      b: { id: "b", message: null, parent: "missing", children: [] },
    };

    const path = resolveCurrentPath(mapping, "b", warnings);

    expect(path.map((node) => node.id)).toEqual(["b"]);
    expect(warnings.some((warning) => warning.code === "NODE_MISSING")).toBe(
      true,
    );
  });

  it("detects cycles while resolving the current path", () => {
    const warnings: ParseWarning[] = [];
    const mapping: Record<string, MappingNode> = {
      a: { id: "a", message: null, parent: "b", children: ["b"] },
      b: { id: "b", message: null, parent: "a", children: ["a"] },
    };

    const path = resolveCurrentPath(mapping, "a", warnings);

    expect(path.map((node) => node.id)).toEqual(["b", "a"]);
    expect(warnings.some((warning) => warning.code === "CYCLE_DETECTED")).toBe(
      true,
    );
  });

  it("filters empty, hidden, system, and tool messages by default", () => {
    const warnings: ParseWarning[] = [];

    expect(
      shouldKeepMessage(
        { ...baseMessage, content: "   " },
        { source: "raw_json" },
        warnings,
      ),
    ).toBe(false);
    expect(
      shouldKeepMessage(
        {
          ...baseMessage,
          metadata: { is_visually_hidden_from_conversation: true },
        },
        { source: "raw_json" },
        warnings,
      ),
    ).toBe(false);
    expect(
      shouldKeepMessage(
        { ...baseMessage, role: "system" },
        { source: "raw_json" },
        warnings,
      ),
    ).toBe(false);
    expect(
      shouldKeepMessage(
        { ...baseMessage, role: "tool" },
        { source: "raw_json" },
        warnings,
      ),
    ).toBe(false);
    expect(
      shouldKeepMessage(baseMessage, { source: "raw_json" }, warnings),
    ).toBe(true);

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "EMPTY_MESSAGE_FILTERED",
        "HIDDEN_MESSAGE_FILTERED",
      ]),
    );
  });

  it("extracts text, code, multimodal attachments, and fallback content", () => {
    expect(
      extractContent({ content_type: "text", parts: ["a", "b"] }).text,
    ).toBe("a\n\nb");
    expect(
      extractContent({ content_type: "code", text: "console.log(1)" }).text,
    ).toBe("console.log(1)");

    const multimodal = extractContent({
      content_type: "multimodal_text",
      parts: [
        "describe this",
        {
          content_type: "image_asset_pointer",
          asset_pointer: "file-service://image.png",
          mime_type: "image/png",
        },
      ],
    });

    expect(multimodal.text).toContain("describe this");
    expect(multimodal.attachments).toHaveLength(1);
    expect(multimodal.attachments[0]?.mime_type).toBe("image/png");

    expect(
      extractContent({ content_type: "custom", text: "fallback text" }).text,
    ).toBe("fallback text");
  });

  it("returns warnings for unknown content types without crashing", () => {
    const warnings: ParseWarning[] = [];
    const content = extractContent(
      { content_type: "unknown_custom_payload" },
      warnings,
      "node-x",
    );

    expect(content).toEqual({
      content_type: "unknown_custom_payload",
      text: "",
      attachments: [],
    });
    expect(warnings[0]).toMatchObject({
      code: "UNSUPPORTED_CONTENT_TYPE",
      node_id: "node-x",
    });
  });

  it("converts timestamps and returns warnings for invalid values", () => {
    const warnings: ParseWarning[] = [];

    expect(toIsoTime(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(toIsoTime(1_779_000_991.967064)).toBe("2026-05-17T06:56:31.967Z");
    expect(toIsoTime("bad timestamp", warnings)).toBeNull();
    expect(warnings[0]?.code).toBe("INVALID_TIMESTAMP");
  });

  it("does not crash when mapping is missing", () => {
    const result = parseConversation(
      { title: "Broken conversation" },
      { source: "raw_json" },
    );

    expect(result.messages).toEqual([]);
    expect(result.warnings[0]?.code).toBe("MAPPING_MISSING");
  });
});
