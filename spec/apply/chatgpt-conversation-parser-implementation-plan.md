# ChatGPT 对话解析浏览器插件开发实施文档

> 来源设计文档：`spec/design/chatgpt-conversation-parser-design.md`  
> 样例数据：`spec/design/file.json`  
> 创建日期：2026-05-22

---

## 1. 设计文档审查结论

已重新检查当前仓库中的设计文档。文档实际位于：

- `spec/design/chatgpt-conversation-parser-design.md`

不是仓库根目录下的 `chatgpt-conversation-parser-design.md`。

整体来看，这份设计文档已经比较完整，覆盖了浏览器插件开发所需的大部分关键点，包括：

- Manifest V3 插件架构；
- Chrome / Edge 兼容策略；
- Raw JSON、当前页面、分享链接、DOM 兜底等多数据源适配器；
- `mapping + current_node` 对话树解析；
- 消息过滤、内容提取、引用处理、多模态降级；
- JSON / Markdown / Text / HTML 导出格式；
- Side Panel、Popup、Options 的 UI 分工；
- 权限最小化、安全隐私、XSS 防护；
- 测试、发布、里程碑与风险应对。

因此，该文档可以作为后续开发主依据。

---

## 2. 已确认的产品与技术决策

以下决策已由产品确认，后续开发第一版时按此执行：

1. **第一版范围**：只做 Raw JSON 导入、解析、预览和导出 Markdown；后续再实现直接解析 ChatGPT 页面，并通过接口获取 response。
2. **技术栈**：确定使用 WXT + React + TypeScript。
3. **主界面**：Side Panel 作为主界面。
4. **历史记录**：第一版不保存历史记录。插件核心能力是把 ChatGPT 对话解析并导出为 Markdown，后续文件保存由用户自行完成。
5. **脱敏功能**：第一版不需要脱敏。
6. **Markdown 适配**：不做 Obsidian / Notion 专属适配；导出标准 Markdown。标准 Markdown 本身可被 Obsidian / Notion 识别，后续如需特殊 frontmatter、callout、数据库字段等再增强。
7. **发布目标**：计划上架 Edge 浏览器。因此第一版完成后需要能在 Edge 中本地加载、调试，并按 Edge Add-ons 审核要求准备权限说明与隐私说明。

---

## 3. 建议补充或明确的内容

虽然设计文档已经较完善，且上述关键决策已确认，但在正式开发前仍建议进一步补充以下细节，避免实现阶段出现歧义。

### 3.1 MVP 边界需要再收敛

设计文档中同时规划了：

- Raw JSON 导入；
- 当前页面解析；
- 分享链接解析；
- Side Panel；
- Popup；
- Options；
- 本地历史；
- 脱敏；
- 引用导出；
- 分支可视化；
- Web Worker。

已确认第一阶段 MVP 明确只做：

1. 初始化浏览器插件工程；
2. Raw JSON 导入；
3. 解析 `mapping + current_node` 当前主干；
4. 预览解析结果；
5. 导出 Markdown；
6. 下载 `.md` 文件；
7. 核心解析单元测试；
8. 确保 Edge 浏览器可本地加载、调试，并为上架做基础准备。

当前页面解析、接口 response 获取、分享链接解析、历史记录、脱敏、JSON / Text / HTML 导出可以放到后续版本。

### 3.2 需要明确目标浏览器版本

设计文档提到 Chrome / Edge 支持 Side Panel，但 Side Panel API 依赖较新的 Chromium 版本。当前已确认目标优先面向 Edge 上架，因此需要优先确认 Edge 最低支持版本。

建议补充：

- 最低 Chrome 版本；
- 最低 Edge 版本；
- Side Panel 不可用时的降级策略；
- 是否允许仅用 Options 页面承载完整 UI 作为兼容兜底。

### 3.3 构建框架选择

已确认采用：

- WXT；
- TypeScript；
- React。

建议第一版保持轻量：

- Tailwind CSS：可以使用，用于快速构建 Side Panel UI；
- Vitest：用于 parser core 单元测试；
- `webextension-polyfill`：可选，若 WXT 已提供足够封装则暂不额外引入；
- Dexie / IndexedDB：第一版不引入，因为不保存历史记录；
- `chrome.storage.local`：仅用于保存少量用户设置，例如默认导出格式。

### 3.4 需要定义 ParseOptions 完整结构

设计文档给出了 `ConversationResult` 和 `ConversationMessage`，但 `ParseOptions` 还需要具体化。

建议至少包含：

```ts
export interface ParseOptions {
  source: 'raw_json' | 'current_page' | 'share_link' | 'dom' | 'unknown';
  includeSystemMessages?: boolean;
  includeToolMessages?: boolean;
  includeHiddenMessages?: boolean;
  includeMetadata?: boolean;
  includeCitations?: boolean;
  includeTimestamps?: boolean;
  includeModel?: boolean;
  outputFormat?: 'markdown';
}
```

### 3.5 需要定义错误码和 warning code

设计文档提到 warning，但没有完整枚举。

建议补充一组稳定 code，便于 UI 展示和测试断言：

- `MAPPING_MISSING`
- `CURRENT_NODE_MISSING`
- `CURRENT_NODE_NOT_FOUND`
- `NODE_MISSING`
- `CYCLE_DETECTED`
- `EMPTY_MESSAGE_FILTERED`
- `HIDDEN_MESSAGE_FILTERED`
- `UNSUPPORTED_CONTENT_TYPE`
- `INVALID_TIMESTAMP`
- `CONTENT_EXTRACTION_FAILED`

### 3.6 需要明确样例数据使用方式

当前样例数据位于：

- `spec/design/file.json`

建议后续开发时复制或软迁移为测试 fixture：

- `tests/fixtures/chatgpt-conversation-sample.json`

避免测试直接依赖 `spec/design` 目录。

### 3.7 需要明确 Markdown 导出细节

设计文档已有示例，但建议补充以下规则：

- heading 层级是否固定为 `## User` / `## Assistant`；
- 是否输出消息序号；
- 是否输出时间和模型；
- assistant 引用列表格式；
- Markdown 内容是否原样保留；
- 是否需要转义 HTML；
- 文件名中中文标题如何处理。

已确认第一版只导出标准 Markdown，不做 Obsidian / Notion 专属格式增强。

### 3.8 需要明确隐私策略落地形式

设计文档强调本地处理，但发布前还需要：

- `privacy.md` 或隐私政策页面；
- Chrome Web Store 权限说明；
- Options 页面里的隐私说明；
- 第一版是否完全禁止远程请求；
- 后续当前页面解析或接口 response 获取需要访问哪些 ChatGPT 域名；
- Edge Add-ons 上架时对权限和数据处理的说明。

### 3.9 需要补充大文件性能策略

样例 `file.json` 已经较大，真实 ChatGPT 导出可能更大。

建议补充：

- JSON 文件大小限制；
- 解析时是否使用 Web Worker；
- 预览是否使用虚拟列表；
- 导出大文件失败时的提示和兜底复制策略。

MVP 可以先不做 Web Worker，但应保留模块边界。

---

## 4. 当前仓库状态

当前仓库已完成 Milestone 0 工程初始化与 Milestone 1 Parser Core，现有结构包括：

```txt
save_chatgpt_history/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── wxt.config.ts
├── src/
│   ├── core/
│   │   ├── index.ts
│   │   ├── parser.ts
│   │   └── types.ts
│   ├── core/exporters/
│   ├── adapters/
│   ├── entrypoints/
│   ├── storage/
│   ├── ui/
│   └── utils/
├── tests/
│   ├── fixtures/chatgpt-conversation-sample.json
│   ├── parser.test.ts
│   └── scaffold.test.ts
└── spec/
    ├── apply/
    └── design/
        ├── chatgpt-conversation-parser-design.md
        └── file.json
```

已验证：

- `npm test` 通过；
- `npx tsc --noEmit` 通过；
- Parser Core 不依赖浏览器 API，可解析复制后的 ChatGPT fixture 并输出当前主干消息；
- 遇到异常 mapping / 节点 / 时间戳等情况会返回稳定 warnings。

---

## 5. 总体开发策略

按照“先核心解析，后插件 UI，再页面适配”的顺序开发。

原因：

1. `parser-core` 是最稳定、最可测试的部分；
2. Raw JSON 导入不依赖 ChatGPT 页面结构，适合作为 MVP；
3. 插件页面解析存在较多不确定性，应在核心能力稳定后实现；
4. 核心解析与插件层解耦，可以降低后续维护成本。

推荐实施顺序：

```txt
工程初始化
  ↓
Parser Core
  ↓
Exporter
  ↓
Raw JSON Adapter
  ↓
Popup / Side Panel UI
  ↓
下载与设置
  ↓
测试与打包
  ↓
当前页面解析增强
```

---

## 6. 开发任务清单

### Milestone 0：工程初始化

目标：创建可运行、可测试、可打包的浏览器插件工程。

任务：

- [x] 初始化 WXT + TypeScript 项目；
- [x] 配置 React；
- [x] 配置 Tailwind CSS；
- [x] 配置 Vitest；
- [ ] 配置 ESLint / Prettier，若项目希望保持轻量可暂缓；
- [x] 创建基础目录结构：
  - `src/core`
  - `src/core/exporters`
  - `src/adapters`
  - `src/entrypoints`
  - `src/utils`
  - `src/ui`
  - `tests/fixtures`
- [x] 将 `spec/design/file.json` 复制为测试 fixture；
- [ ] 确认 Chrome / Edge 本地加载流程。

验收标准：

- [ ] `npm run dev` 可启动扩展开发模式；
- [x] `npm run build` 可生成扩展包；
- [x] `npm run test` 可运行测试；
- [ ] Chrome / Edge 能本地加载扩展。

---

### Milestone 1：Parser Core

目标：实现不依赖浏览器 API 的 ChatGPT 原始 JSON 解析核心。

状态：已完成。

任务：

- [x] 定义核心类型：
  - `ConversationResult`
  - `ConversationMessage`
  - `ParseOptions`
  - `ParseWarning`
  - `MappingNode`
  - `RawConversation`
  - `Citation`
  - `AttachmentRef`
- [x] 实现 `normalizeRawConversation(raw)`；
- [x] 实现 `parseConversation(raw, options)`；
- [x] 实现 `resolveCurrentPath(mapping, currentNode, warnings)`；
- [x] 实现 `inferLatestLeafNode(mapping, warnings)`；
- [x] 实现循环引用检测；
- [x] 实现缺失节点 warning；
- [x] 实现 `extractMessage(node, root, warnings)`；
- [x] 实现 `shouldKeepMessage(message, options)`；
- [x] 实现 `extractContent(content, warnings)`；
- [x] 实现 `extractCitations(message)`；
- [x] 实现时间转换 `toIsoTime(value)`；
- [x] 实现模型字段提取优先级。

验收标准：

- [x] 能解析 `spec/design/file.json` 或复制后的 fixture；
- [x] 能输出当前主干消息；
- [x] 默认只保留 user / assistant 可见消息；
- [x] 遇到异常节点不崩溃，并返回 warnings；
- [x] 单元测试覆盖主干路径、过滤、内容提取、时间转换。

执行记录：

- 新增 `src/core/types.ts` 定义 Parser Core 的统一类型；
- 新增 `src/core/parser.ts` 实现解析入口、主干路径解析、内容提取、消息过滤、引用提取、时间转换和模型字段优先级；
- 新增 `src/core/index.ts` 统一导出 core API；
- 新增 `tests/parser.test.ts` 覆盖 fixture 主干解析、过滤、内容提取、时间转换、缺失 mapping、缺失节点与循环引用；
- 新增 `src/vite-env.d.ts` 补充 CSS module 声明，保证 `npx tsc --noEmit` 通过；
- 验证命令：`npm test`、`npx tsc --noEmit` 均通过。

---

### Milestone 2：Markdown Exporter

目标：将统一的 `ConversationResult` 导出为标准 Markdown 文件。

状态：已完成。

任务：

- [x] 实现 Markdown exporter；
- [x] 实现 `sanitizeFilename(title)`；
- [x] 实现 `buildExportFilename(conversation)`，固定生成 `.md` 文件名；
- [x] 支持 Markdown 导出选项：
  - 是否包含时间；
  - 是否包含模型；
  - 是否包含引用；
  - 是否包含基础 metadata。

说明：第一版不提供 JSON / Text / HTML 文件导出。`ConversationResult` 仍作为内部结构存在，用于解析、预览和测试。

Markdown 初始格式建议：

```md
# {title}

- Conversation ID: {conversation_id}
- Created At: {created_at}
- Updated At: {updated_at}
- Message Count: {message_count}
- Source: {source}

---

## User

{content}

## Assistant

{content}
```

验收标准：

- [x] Markdown 导出可读；
- [x] Markdown 可被 Obsidian / Notion 作为普通 Markdown 导入或打开；
- [x] 文件名不包含非法字符；
- [x] 对空标题、超长标题、中文标题处理正常。

执行记录：

- 新增 `src/core/exporters/markdown-exporter.ts`，实现 `toMarkdown`、`sanitizeFilename`、`buildExportFilename` 与 `MarkdownExportOptions`；
- 更新 `src/core/index.ts` 统一导出 Markdown Exporter API；
- 新增 `tests/markdown-exporter.test.ts`，覆盖 Markdown 内容、导出选项、文件名清理、`.md` 文件名生成以及真实 `spec/design/file.json` 回归导出；
- 测试会生成 `.output/markdown-exporter/spec-design-file.md` 供人工查看；
- 验证命令：`npm test`、`npx tsc --noEmit` 均通过。

---

### Milestone 3：Raw JSON Adapter

目标：支持用户导入 ChatGPT 原始 JSON 文件。

任务：

- [ ] 实现 `RawJsonAdapter`；
- [ ] 支持从 `File` 读取文本；
- [ ] 解析 JSON；
- [ ] 判断是否包含 `mapping`；
- [ ] 调用 `parseConversation`；
- [ ] 返回统一结果或用户可理解错误。

错误提示：

- JSON 格式错误；
- 文件为空；
- `mapping` 缺失；
- 解析结果为空；
- 文件过大。

验收标准：

- [ ] 用户选择 `file.json` 后能成功解析；
- [ ] 非 JSON 文件有明确提示；
- [ ] 缺少 `mapping` 的 JSON 有明确提示。

---

### Milestone 4：插件 MVP UI

目标：完成用户可操作的浏览器插件界面。

任务：

- [ ] 实现 Popup 快捷入口；
- [ ] 实现 Side Panel 主界面；
- [ ] Popup 提供：
  - 打开 Side Panel；
  - 导入 JSON；
  - 打开设置；
- [ ] Side Panel 提供：
  - JSON 文件拖拽 / 选择；
  - 解析按钮；
  - 解析状态；
  - warning 列表；
  - 消息预览；
  - Markdown 导出设置；
  - 下载 `.md` 按钮；
  - 复制 Markdown 按钮；
- [ ] Options 页面提供基础设置：
  - 是否包含时间；
  - 是否包含模型；
  - 是否包含引用。

说明：第一版不做历史记录，也不提供用户文件管理能力。

验收标准：

- [ ] 用户能从插件入口导入 JSON；
- [ ] 用户能看到解析结果预览；
- [ ] 用户能选择格式并下载；
- [ ] UI 对错误状态有明确提示。

---

### Milestone 5：下载、复制与本地设置

目标：补齐导出交互和基础设置持久化。

任务：

- [ ] 使用 `chrome.downloads.download` 下载文件；
- [ ] 实现 Blob URL 创建和释放；
- [ ] 实现复制 Markdown 到剪贴板；
- [ ] 使用 `chrome.storage.local` 保存基础设置；
- [ ] 下载失败时提供复制兜底；
- [ ] 设置项在 Popup / Side Panel / Options 间保持一致。

验收标准：

- [ ] 下载 Markdown 正常；
- [ ] 下载失败时能复制 Markdown 内容；
- [ ] 设置刷新后仍保留。

---

### Milestone 6：测试

目标：保障解析器和导出器稳定。

任务：

- [ ] 为 `resolveCurrentPath` 写测试；
- [ ] 为 `inferLatestLeafNode` 写测试；
- [ ] 为 `shouldKeepMessage` 写测试；
- [ ] 为 `extractContent` 写测试；
- [ ] 为 `toMarkdown` 写测试；
- [ ] 为 `sanitizeFilename` 写测试；
- [ ] 使用样例 `file.json` 做 fixture 回归测试；
- [ ] 构造异常 fixture：
  - `current_node` 缺失；
  - parent 断裂；
  - 循环引用；
  - 空消息；
  - `content_type` 未知；
  - 多分支。

验收标准：

- [ ] 核心测试通过；
- [ ] 样例 fixture 可稳定解析；
- [ ] 异常 fixture 不导致解析器崩溃。

---

### Milestone 7：当前页面解析与接口 response 获取，后续版本

目标：用户打开 ChatGPT 页面后，插件可在用户主动触发时解析当前会话，并优先通过页面上下文或接口 response 获取结构化数据。

任务：

- [ ] content script 判断当前页面是否为 ChatGPT；
- [ ] 设计页面解析权限申请流程；
- [ ] 在用户触发后注入 page bridge；
- [ ] 从页面上下文或网络 response 中获取当前会话结构化数据；
- [ ] 将接口 response 转换为 `ConversationResult`；
- [ ] 结构化获取失败时，再考虑 DOM 可见内容作为兜底；
- [ ] 失败时提示用户导入 JSON。

验收标准：

- [ ] 在 ChatGPT 会话页能解析当前会话；
- [ ] 接口或页面结构变化时失败可控；
- [ ] 非 ChatGPT 页面提示清晰；
- [ ] 不绕过用户登录态或权限限制。

---

### Milestone 8：分享链接解析，后续版本

目标：支持解析公开分享链接。

任务：

- [ ] 校验分享链接域名和路径；
- [ ] 抓取分享页 HTML；
- [ ] 尝试解析内嵌 JSON 数据；
- [ ] 失败时退化为 DOM 解析；
- [ ] 标记 `source = 'share_link'`；
- [ ] 在 UI 中说明分享链接解析可能因页面变化失效。

验收标准：

- [ ] 常见 `chatgpt.com/share/*` 链接可解析；
- [ ] 失败时有明确原因；
- [ ] 不请求无关第三方域名。

---

### Milestone 9：隐私、安全与发布准备

目标：满足 Edge Add-ons 上架要求，并尽量兼容 Chrome 后续发布。

任务：

- [ ] 编写隐私说明；
- [ ] 明确说明默认本地处理，不上传对话内容；
- [ ] 权限申请文案最小化；
- [ ] 检查是否存在远程请求；
- [ ] 检查 XSS 风险；
- [ ] Markdown / HTML 预览使用安全渲染策略；
- [ ] 准备商店截图、描述、权限说明；
- [ ] 优先测试 Edge 本地安装包；
- [ ] 同步验证 Chrome 本地安装兼容性。

验收标准：

- [ ] 权限说明与实际用途一致；
- [ ] 没有无必要的 `<all_urls>` 权限；
- [ ] 没有上传用户对话内容；
- [ ] Edge 打包产物可安装、可调试；
- [ ] Chrome 打包产物无明显兼容问题。

---

## 7. 推荐首批文件结构

建议后续实际开发创建如下结构：

```txt
save_chatgpt_history/
├── package.json
├── wxt.config.ts
├── tsconfig.json
├── src/
│   ├── core/
│   │   ├── types.ts
│   │   ├── parser.ts
│   │   ├── normalize.ts
│   │   ├── path-resolver.ts
│   │   ├── message-filter.ts
│   │   ├── content-extractor.ts
│   │   ├── citations.ts
│   │   └── exporters/
│   │       └── markdown-exporter.ts
│   ├── adapters/
│   │   └── raw-json-adapter.ts
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── popup/
│   │   ├── sidepanel/
│   │   └── options/
│   ├── storage/
│   │   └── settings-store.ts
│   ├── ui/
│   │   └── components/
│   └── utils/
│       ├── filename.ts
│       ├── time.ts
│       └── download.ts
├── tests/
│   ├── fixtures/
│   │   └── chatgpt-conversation-sample.json
│   ├── parser.test.ts
│   ├── exporter.test.ts
│   └── filename.test.ts
└── spec/
    ├── design/
    └── apply/
```

---

## 8. 第一阶段优先任务

如果现在开始编码，建议先按以下顺序执行：

1. 初始化 WXT + TypeScript + React 工程；
2. 创建 `src/core/types.ts`；
3. 创建 `src/core/path-resolver.ts`；
4. 创建 `src/core/content-extractor.ts`；
5. 创建 `src/core/message-filter.ts`；
6. 创建 `src/core/parser.ts`；
7. 创建 Markdown exporter；
8. 引入 `spec/design/file.json` 作为 fixture；
9. 写解析器单元测试；
10. 再做 Raw JSON 导入 UI；
11. 验证 Edge 本地加载和调试流程。

---

## 9. 暂不开发的内容

以下内容建议暂缓，不进入第一阶段：

- 当前页面精准解析；
- 注入 page world 读取 ChatGPT 前端状态；
- 拦截 fetch；
- 分享链接解析；
- IndexedDB 历史记录；
- 脱敏功能；
- JSON / Text / HTML / PDF 导出；
- 分支树可视化；
- Web Worker；
- 自定义导出模板；
- 批量导出。

这些功能依赖核心能力稳定后再逐步实现。

---

## 10. 产品确认记录

以下问题已确认：

1. 第一版只做 Raw JSON 导入、解析、预览和 Markdown 导出。
2. 技术栈使用 WXT + React + TypeScript。
3. Side Panel 作为主界面。
4. 第一版不保存历史记录。
5. 第一版不做脱敏功能。
6. Markdown 导出使用标准 Markdown，不做 Obsidian / Notion 专属适配。
7. 计划上架 Edge 浏览器，第一版完成后需要支持 Edge 本地加载、调试和上架准备。

---

## 11. 本实施文档结论

设计文档已经可以指导开发，但第一阶段需要主动收敛范围。

推荐 MVP 聚焦：

- 解析核心可靠；
- JSON 导入稳定；
- Markdown 导出好用；
- 插件 UI 简单可用；
- Edge 可本地加载、调试并具备上架准备基础；
- 本地处理、权限最小化。

后续再扩展当前页面解析、接口 response 获取、分享链接解析和分支能力。
