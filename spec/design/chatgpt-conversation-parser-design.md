# ChatGPT 对话解析浏览器插件 — 开发设计文档（审查完善版）

> 角色定位：Chrome / Edge 浏览器扩展，基于 Manifest V3。  
> 核心目标：在用户授权和本地优先的前提下，从 ChatGPT 页面、分享链接或导入的 JSON 中解析对话，清洗为稳定结构，并支持 JSON / Markdown / Text / HTML 导出。

---

## 0. 文档审查结论

原设计文档已经覆盖了 ChatGPT 原始 JSON 的基础结构、`mapping` 对话树、主干回溯、消息过滤、导出格式等核心问题，方向正确。但如果目标是开发 **Chrome / Edge 浏览器插件**，仍有以下可优化点：

### 0.1 需要从“脚本工具设计”升级为“浏览器扩展产品设计”

原文偏向 Node.js / Python 工具，浏览器扩展只作为备选方案。实际插件开发应优先补充：

- Manifest V3 架构
- `content_scripts`、`background service worker`、`sidePanel` / `popup` 的职责边界
- Chrome 与 Edge 的兼容性策略
- 权限最小化设计
- 跨域请求、Cookie、登录态、CSP、页面隔离世界等限制
- 用户隐私、数据本地化、导出安全

### 0.2 数据获取方式需要分层兜底

ChatGPT 页面和接口结构变化频繁，不能把实现绑定在单一内部 API 上。建议采用“多适配器”策略：

1. **Raw JSON 导入适配器**：最稳定，用于用户拖拽或选择文件导入。
2. **分享链接适配器**：解析公开分享页或分享接口返回数据。
3. **当前页面适配器**：从 ChatGPT 当前会话页面提取可见消息。
4. **页面运行时桥接适配器**：必要时在页面上下文中读取前端状态或拦截 fetch 响应。
5. **DOM 兜底适配器**：当接口不可用时，只提取页面可见内容。

### 0.3 解析层应和插件层解耦

建议把核心解析能力设计为纯 TypeScript 包：

- 输入：`unknown` 原始 JSON / DOM 抽取结果 / 分享页数据
- 输出：统一的 `ConversationResult`
- 不依赖 Chrome API
- 可独立做单元测试与 fixture 回归测试

这样后续可以复用到：

- 浏览器扩展
- Node CLI
- Web App
- 桌面 App

### 0.4 需要补充分支对话与非文本消息策略

ChatGPT 对话并不总是线性结构，常见情况包括：

- 用户编辑后产生分支
- assistant 重新生成后产生多个候选分支
- tool / web.run / python / image / canvas 等中间消息
- `content.parts` 中可能不是单纯字符串
- `message.content.content_type` 可能是 `text`、`code`、`multimodal_text`、`user_editable_context`、`model_editable_context` 等

解析规则应显式说明：默认导出当前主干路径，同时保留扩展能力支持分支导出。

### 0.5 需要补充插件交互、状态管理、测试与发布流程

原文缺少：

- 插件 UI 信息架构
- 导出前预览与脱敏选项
- 本地缓存策略
- 错误提示文案
- 单元测试、E2E 测试、fixture 管理
- Chrome Web Store / Edge Add-ons 发布注意事项

---

## 1. 项目背景与目标

### 1.1 背景

用户在 ChatGPT 中沉淀了大量有价值的对话内容，但官方导出能力通常存在以下问题：

- 导出路径长，不能针对单条会话快速导出。
- 导出格式不适合二次处理。
- 对话树、分支、引用、工具调用等结构信息难以保留。
- 页面复制容易丢失 Markdown、代码块、引用和时间信息。
- 私密内容需要本地处理，不适合上传第三方服务。

因此需要一个浏览器插件，在用户主动触发时，从 ChatGPT 会话页面、分享链接或本地 JSON 中解析对话，并导出为可读、可存档、可二次加工的格式。

### 1.2 产品目标

#### 必须达成

- 支持 Chrome 与 Edge。
- 支持解析 ChatGPT 原始对话 JSON。
- 支持从 `mapping + current_node` 还原当前主干对话。
- 支持过滤系统、隐藏、空内容、工具中间态消息。
- 支持导出 JSON、Markdown、Text。
- 所有数据默认只在本地处理，不上传服务器。
- 插件权限最小化，用户主动触发后才读取页面数据。

#### 应该达成

- 支持 ChatGPT 分享链接解析。
- 支持当前页面一键导出。
- 支持导出前预览、选择消息范围、选择是否包含引用。
- 支持保留代码块、列表、表格、链接、引用标记。
- 支持本地历史记录和重复导出。
- 支持异常诊断面板，方便用户反馈样本。

#### 后续增强

- 支持导出 HTML、PDF、Notion Markdown、Obsidian Markdown。
- 支持多会话批量导出。
- 支持分支树可视化。
- 支持脱敏规则，例如邮箱、手机号、Token、Cookie、API Key。
- 支持用户自定义导出模板。

---

## 2. 范围与非目标

### 2.1 当前版本范围

MVP 聚焦四件事：

1. 用户在 ChatGPT 会话页点击插件。
2. 插件识别当前页面或要求用户导入 JSON。
3. 插件解析并预览对话。
4. 用户选择格式并下载。

### 2.2 非目标

以下能力不建议放入第一版：

- 后端服务同步。
- 自动登录或绕过 ChatGPT 权限限制。
- 大规模爬取用户全部历史会话。
- 绕过站点反爬策略。
- 上传用户对话到第三方模型进行总结。
- 依赖非公开接口作为唯一数据来源。

---

## 3. 总体架构

### 3.1 推荐技术栈

| 层级 | 推荐方案 | 说明 |
|---|---|---|
| 扩展框架 | WXT + TypeScript | 对 MV3、Chrome、Edge 支持友好，工程化清晰 |
| UI | React + Tailwind CSS | 快速构建 side panel / popup |
| 状态管理 | Zustand 或 React Context | 插件状态较轻，不需要复杂状态机 |
| 存储 | IndexedDB + Dexie，或 chrome.storage.local | 大文本建议 IndexedDB，小配置用 storage.local |
| 解析核心 | TypeScript 纯函数模块 | 与插件 API 解耦，便于测试 |
| 测试 | Vitest + Playwright | 单测解析器，E2E 验证插件流程 |
| 打包发布 | WXT build | 分别产出 Chrome / Edge 包 |

### 3.2 架构分层

```/dev/null/architecture.txt#L1-20
Browser Extension
├── UI Layer
│   ├── Side Panel
│   ├── Popup
│   └── Options Page
├── Extension Runtime Layer
│   ├── Background Service Worker
│   ├── Content Script
│   └── Injected Page Script
├── Acquisition Layer
│   ├── RawJsonAdapter
│   ├── ShareLinkAdapter
│   ├── CurrentPageAdapter
│   ├── PageRuntimeAdapter
│   └── DomFallbackAdapter
├── Parser Core
│   ├── Normalize
│   ├── Path Resolver
│   ├── Message Filter
│   ├── Content Extractor
│   └── Exporter
└── Storage & Download
    ├── IndexedDB
    ├── chrome.storage.local
    └── chrome.downloads
```

### 3.3 模块职责

| 模块 | 职责 |
|---|---|
| `content-script` | 识别页面、读取 DOM、与页面脚本通信 |
| `injected-script` | 在页面主世界中访问前端运行时数据或包装 fetch，仅在用户触发时启用 |
| `background` | 统一调度、下载文件、跨页面消息、权限检查 |
| `side-panel` | 主 UI，展示解析结果、导出配置、错误提示 |
| `parser-core` | 解析 ChatGPT JSON，输出统一结构 |
| `exporter` | 将统一结构转为 JSON / Markdown / Text / HTML |
| `storage` | 保存用户设置、历史记录、临时解析结果 |

---

## 4. 浏览器扩展设计

### 4.1 Manifest V3 基础配置

建议权限保持最小化：

- `storage`：保存配置与导出历史。
- `downloads`：下载导出文件。
- `activeTab`：用户点击插件后临时访问当前页面。
- `scripting`：必要时注入脚本。
- `sidePanel`：Chrome / Edge 支持时使用侧边栏。
- `host_permissions`：优先使用可选权限，只在用户授权后访问 `https://chatgpt.com/*`。

不建议默认申请过宽权限，例如 `<all_urls>`。

### 4.2 Chrome / Edge 兼容性

| 能力 | Chrome | Edge | 兼容策略 |
|---|---|---|---|
| Manifest V3 | 支持 | 支持 | 统一 MV3 |
| Side Panel API | 新版支持 | 新版支持 | 不支持时退化到 popup / options page |
| `chrome.*` API | 支持 | 支持 | 使用 `webextension-polyfill` 统一 Promise 风格 |
| Store 审核 | Chrome Web Store | Edge Add-ons | 权限说明和隐私说明要清晰 |

### 4.3 页面隔离与脚本注入

Chrome 扩展存在隔离世界：

- `content-script` 不能直接访问页面 JS 变量。
- 如需访问页面运行时状态，需要注入 `injected-script` 到 page world。
- `injected-script` 与 `content-script` 通过 `window.postMessage` 通信。
- 通信必须校验 `source`、`type`、`nonce`，避免被页面伪造消息。

### 4.4 跨域与登录态限制

插件不能假设可以稳定调用 ChatGPT 内部接口。需要注意：

- 内部接口可能变更、限流或需要 CSRF / Authorization。
- 通过扩展发起 fetch 时，Cookie 与 CORS 行为和页面内请求不同。
- 页面 CSP 可能影响注入脚本加载方式。
- 不应绕过用户权限或访问用户未打开的私有数据。

因此第一版应以“用户当前页面可见数据 + 用户主动导入 JSON”为主要路径，分享链接解析作为增强路径。

---

## 5. 数据获取策略

### 5.1 获取策略优先级

| 优先级 | 策略 | 稳定性 | 完整性 | 说明 |
|---:|---|---|---|---|
| 1 | Raw JSON 导入 | 高 | 高 | 用户导入 ChatGPT 返回 JSON 或备份文件 |
| 2 | 当前页面运行时数据 | 中 | 高 | 依赖 ChatGPT 前端结构，需适配 |
| 3 | 分享链接数据 | 中 | 中高 | 公开分享页可解析，但结构会变 |
| 4 | DOM 可见内容 | 高 | 中低 | 最稳定兜底，但时间、模型、引用可能不完整 |
| 5 | 内部 API 请求 | 低到中 | 高 | 不作为唯一依赖，易受权限和变更影响 |

### 5.2 Raw JSON 导入

用户可通过文件选择或拖拽导入 `.json` 文件。插件读取后：

1. 校验 JSON 格式。
2. 判断是否包含 `mapping`。
3. 调用 `parseConversation(raw)`。
4. 展示预览与导出按钮。

这是最适合作为 MVP 的稳定入口。

### 5.3 当前页面解析

当前页面解析应包含两种模式：

#### 精准模式

通过页面运行时数据、Next.js 数据、已加载的 conversation store 或网络响应缓存获取结构化数据。

优点：信息完整。  
缺点：依赖 ChatGPT 前端实现，维护成本较高。

#### 可见模式

通过 DOM 提取当前页面可见消息。

优点：稳定、无需依赖内部接口。  
缺点：只能导出当前渲染内容，缺少 `conversation_id`、模型、时间戳、分支、隐藏元数据。

### 5.4 分享链接解析

分享链接可能形如：

- `https://chatgpt.com/share/{share_id}`
- `https://chat.openai.com/share/{share_id}`

处理流程：

1. 校验域名和路径。
2. 尝试抓取分享页 HTML。
3. 尝试从内嵌数据脚本中解析会话数据。
4. 若失败，退化到 DOM 解析。
5. 标记结果来源为 `share`。

### 5.5 内部 API 的设计原则

如果后续实现内部 API 适配器，必须满足：

- 只在用户主动触发时请求。
- 不存储或外传 Cookie、Token。
- 请求失败时有明确兜底方案。
- 将接口路径、字段映射封装在 adapter 中，避免污染核心解析逻辑。
- 在 UI 中提示该能力可能因 ChatGPT 更新而失效。

---

## 6. ChatGPT 原始 JSON 数据结构分析

### 6.1 根级字段

常见字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 对话标题 |
| `conversation_id` | string | 会话 ID |
| `create_time` | number | 创建时间，Unix 秒，可能含小数 |
| `update_time` | number | 更新时间，Unix 秒，可能含小数 |
| `mapping` | object | 对话节点映射，核心字段 |
| `current_node` | string | 当前会话分支末端节点 |
| `default_model_slug` | string | 默认模型标识 |
| `moderation_results` | array | 审核结果 |
| `safe_urls` | array | 安全链接列表 |
| `is_archived` | boolean | 是否归档 |
| `is_starred` | boolean | 是否星标 |

### 6.2 mapping 节点结构

`mapping` 是一个以节点 ID 为 key 的对象。每个节点大致包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 节点 ID |
| `message` | object 或 null | 消息对象，根节点可能为 null |
| `parent` | string 或 null | 父节点 ID |
| `children` | string[] | 子节点 ID 列表 |

### 6.3 message 对象结构

常见字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 消息 ID |
| `author.role` | string | `system` / `user` / `assistant` / `tool` |
| `author.name` | string 或 null | 作者名称，工具消息常见为 `web.run` |
| `content.content_type` | string | 内容类型 |
| `content.parts` | array | 文本消息的主要内容片段 |
| `content.text` | string | 代码或特殊内容可能使用该字段 |
| `create_time` | number 或 null | 消息创建时间 |
| `update_time` | number 或 null | 消息更新时间 |
| `status` | string | 消息状态 |
| `end_turn` | boolean 或 null | 是否结束回合 |
| `weight` | number | 权重，常用于判断是否为有效显示消息 |
| `metadata` | object | 模型、引用、工具、隐藏标记等元数据 |
| `recipient` | string | 接收者 |
| `channel` | string | 通道 |

### 6.4 role 枚举

| role | 是否默认导出 | 说明 |
|---|---:|---|
| `user` | 是 | 用户可见输入 |
| `assistant` | 是 | 助手可见回复 |
| `system` | 否 | 系统消息、隐藏上下文、开发者指令等 |
| `tool` | 否 | 工具调用中间结果，可作为可选调试导出 |

### 6.5 content_type 枚举与处理策略

| content_type | 默认处理 | 说明 |
|---|---|---|
| `text` | 提取 `parts` | 最常见类型 |
| `code` | 提取 `text`，保留语言信息 | 可能来自搜索/工具/代码响应 |
| `multimodal_text` | 提取文字 parts，附件转为 metadata | 图片、文件等需要额外处理 |
| `user_editable_context` | 默认过滤 | 用户画像和上下文，通常隐藏 |
| `model_editable_context` | 默认过滤 | 模型上下文，通常隐藏 |
| `tether_quote` | 可选保留 | 引用内容 |
| 未知类型 | 标记 unsupported，尽量降级提取文本 | 避免解析中断 |

---

## 7. 对话树解析算法

### 7.1 默认主干路径

默认导出当前分支，即从 `current_node` 向上回溯到根节点，再反转。

如果 `current_node` 缺失，则使用启发式策略：

1. 找出所有叶子节点。
2. 优先选择更新时间最新的叶子节点。
3. 如果没有时间，选择路径最长的叶子节点。
4. 如果仍无法判断，选择 `mapping` 中最后出现的叶子节点。

### 7.2 分支处理

第一版默认只导出当前主干路径，但数据结构应预留分支信息：

- `branch_id`
- `parent_message_id`
- `sibling_index`
- `sibling_count`
- `is_current_branch`

后续可支持：

- 仅当前分支
- 全部分支平铺导出
- 分支树可视化
- 按用户选择导出某条分支

### 7.3 节点异常处理

需要处理以下情况：

- `mapping` 为空。
- 节点 ID 重复或节点对象缺失。
- `parent` 指向不存在节点。
- 存在循环引用。
- `children` 与 `parent` 不一致。
- 节点有 message 但内容为空。

解析器不能因单个坏节点崩溃，应记录 warning 并尽量返回可用结果。

---

## 8. 消息清洗规则

### 8.1 默认保留规则

默认只保留满足以下条件的消息：

- `message` 存在。
- `author.role` 为 `user` 或 `assistant`。
- 不是视觉隐藏消息。
- 内容提取后非空。
- 消息状态不是明显失败或中断的无效状态。

### 8.2 默认过滤规则

以下消息默认过滤：

- `role = system`。
- `role = tool`。
- `metadata.is_visually_hidden_from_conversation = true`。
- `content_type = user_editable_context`。
- `content_type = model_editable_context`。
- 内容为空字符串或只有空白字符。
- 纯工具查询、搜索中间态、内部推理中间态。

### 8.3 可选保留规则

用户可在高级选项中选择保留：

- 工具调用摘要。
- Web 搜索引用。
- 模型名称。
- 时间戳。
- 消息 ID。
- 分支信息。
- 原始 metadata。

---

## 9. 内容提取规则

### 9.1 文本内容

对于 `content.parts`：

- 如果元素是字符串，直接拼接。
- 如果元素是对象，尝试提取 `text`、`content`、`name`、`url` 等字段。
- 多个 part 之间默认用空行连接。
- 保留 Markdown 原始格式。

### 9.2 代码内容

对于 `content_type = code`：

- 提取 `content.text`。
- 读取 `content.language`。
- Markdown 导出时包装为代码块。
- 如果语言未知，使用空语言标识，不强行猜测。

### 9.3 引用与链接

ChatGPT 可能在文本中使用特殊引用标记，或在 metadata 中保存引用：

- `metadata.citations`
- `metadata.content_references`
- `metadata.search_result_groups`
- `safe_urls`

建议导出策略：

- Markdown 正文尽量保留可读链接。
- 引用列表放在每条 assistant 消息末尾。
- JSON 中完整保留结构化引用。
- 如果无法解析引用，保留原始标记，不要误删内容。

### 9.4 多模态内容

对于图片、文件、语音等多模态内容：

- 第一版不下载附件。
- 文本中使用占位描述，例如 `[Image]`、`[File: name.pdf]`。
- JSON 中保留附件 metadata。
- UI 中提示“该导出不包含二进制附件”。

---

## 10. 输出数据结构

### 10.1 ConversationResult

```/dev/null/types.ts#L1-60
export interface ConversationResult {
  schema_version: '1.0';
  source: 'raw_json' | 'current_page' | 'share_link' | 'dom' | 'unknown';
  conversation_id: string | null;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  default_model: string | null;
  current_node: string | null;
  message_count: number;
  branch_count?: number;
  warnings: ParseWarning[];
  messages: ConversationMessage[];
  raw_summary?: RawSummary;
}

export interface ConversationMessage {
  id: string;
  node_id: string;
  parent_node_id: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'unknown';
  author_name: string | null;
  content: string;
  content_type: string;
  created_at: string | null;
  updated_at: string | null;
  model: string | null;
  status: string | null;
  end_turn: boolean | null;
  citations: Citation[];
  attachments: AttachmentRef[];
  metadata?: Record<string, unknown>;
}

export interface ParseWarning {
  code: string;
  message: string;
  node_id?: string;
  severity: 'info' | 'warning' | 'error';
}
```

### 10.2 时间格式

- 输入：Unix 秒，可能为小数。
- 输出：ISO 8601 字符串。
- UI 展示：使用用户本地时区。
- JSON 导出：保留 ISO 字符串，并可选保留原始 timestamp。

### 10.3 模型字段提取优先级

模型信息建议按以下顺序提取：

1. `message.metadata.model_slug`
2. `message.metadata.default_model_slug`
3. `message.metadata.resolved_model_slug`
4. 根级 `default_model_slug`
5. `null`

---

## 11. 导出格式

### 11.1 JSON

JSON 导出应包含完整结构，适合二次开发和备份。

特性：

- 保留 `schema_version`。
- 保留消息 ID、节点 ID、时间、模型、引用。
- 可选保留原始 metadata。
- 默认不包含完整原始 JSON，避免文件过大。

### 11.2 Markdown

Markdown 适合知识库、Obsidian、Notion、Git 仓库沉淀。

建议格式：

```/dev/null/export.md#L1-28
# 对话标题

- Conversation ID: xxx
- Created At: 2026-05-15T10:00:00.000Z
- Updated At: 2026-05-16T10:00:00.000Z
- Message Count: 12
- Source: raw_json

---

## User

用户消息内容。

## Assistant

助手回复内容。

References:

1. https://example.com
```

### 11.3 Text

纯文本导出适合快速阅读和发送。

格式：

```/dev/null/export.txt#L1-18
Title: 对话标题
Conversation ID: xxx

[User]
用户消息内容

[Assistant]
助手回复内容
```

### 11.4 HTML

HTML 可作为后续增强：

- 保留样式。
- 支持代码高亮。
- 支持折叠 metadata。
- 支持打印为 PDF。

---

## 12. 插件 UI 设计

### 12.1 Side Panel 主界面

建议优先使用 Side Panel，信息承载能力强。

页面分区：

1. 当前页面状态
   - 是否识别为 ChatGPT 页面
   - 是否可解析
   - 当前 URL
2. 数据来源选择
   - 当前页面
   - 分享链接
   - 导入 JSON
3. 解析结果预览
   - 标题
   - 消息数量
   - 时间范围
   - warning 列表
4. 导出设置
   - 格式
   - 是否包含时间
   - 是否包含模型
   - 是否包含引用
   - 是否包含工具消息
   - 是否脱敏
5. 操作按钮
   - 解析
   - 复制 Markdown
   - 下载
   - 保存到历史

### 12.2 Popup 轻量入口

Popup 只作为快捷入口：

- “打开侧边栏”
- “导入 JSON”
- “导出当前页面”
- “打开设置”

不要在 Popup 中承载复杂预览。

### 12.3 Options 设置页

设置项：

- 默认导出格式。
- 默认文件名模板。
- 默认是否包含元数据。
- 默认脱敏规则。
- 是否保存历史记录。
- 是否启用实验性当前页面精准解析。

### 12.4 错误提示设计

错误提示应面向用户可理解，例如：

| 场景 | 文案 |
|---|---|
| 非 ChatGPT 页面 | 当前页面不是支持的 ChatGPT 页面，请打开一个会话或导入 JSON。 |
| 无法读取结构化数据 | 未能读取完整会话，已尝试使用页面可见内容导出。 |
| JSON 格式错误 | 文件不是有效 JSON，请检查文件内容。 |
| mapping 缺失 | 该 JSON 不包含 ChatGPT 对话树字段 `mapping`。 |
| 权限不足 | 需要你授权插件访问 chatgpt.com 页面后才能解析当前会话。 |

---

## 13. 安全与隐私设计

### 13.1 隐私原则

- 默认本地处理。
- 默认不上传任何对话内容。
- 不收集 Cookie、Token、账号信息。
- 不把对话内容写入远程日志。
- 用户明确操作后才读取页面内容。
- 隐私政策中明确说明数据处理方式。

### 13.2 权限最小化

建议第一版权限：

- `storage`
- `downloads`
- `activeTab`
- `scripting`
- `sidePanel`

`host_permissions` 使用 optional 模式，用户启用“解析当前 ChatGPT 页面”时再申请。

### 13.3 脱敏能力

导出前可选脱敏：

- 邮箱
- 手机号
- URL query 中的 token
- API Key 常见模式
- Cookie 字样
- Bearer Token
- 身份证等本地化规则

脱敏应在本地完成，并允许用户预览。

### 13.4 XSS 防护

预览 Markdown / HTML 时必须注意：

- 不直接使用未净化的 HTML。
- Markdown 渲染后使用 DOMPurify 等库净化。
- 链接默认 `rel="noopener noreferrer"`。
- 不执行导出内容中的脚本。

---

## 14. 错误处理与边界情况

### 14.1 数据层异常

| 异常 | 处理 |
|---|---|
| `mapping` 缺失 | 返回错误，提示不支持该 JSON |
| `current_node` 缺失 | 使用叶子节点启发式策略 |
| 消息内容为空 | 过滤并记录 info warning |
| 节点引用断裂 | 跳过断裂节点，记录 warning |
| content_type 未知 | 尝试提取文本，记录 warning |
| 时间戳非法 | 输出 null，记录 warning |

### 14.2 页面层异常

| 异常 | 处理 |
|---|---|
| 页面未加载完成 | 提示用户等待或重试 |
| 页面结构变化 | 进入 DOM 兜底模式 |
| 权限不足 | 引导用户授权 |
| 注入失败 | 提示刷新页面或使用 JSON 导入 |

### 14.3 导出异常

| 异常 | 处理 |
|---|---|
| 下载失败 | 提供复制到剪贴板 |
| 文件名非法 | 自动替换非法字符 |
| 内容过大 | 分片导出或提示用户使用 JSON |
| IndexedDB 失败 | 不保存历史，但允许下载 |

---

## 15. 文件命名策略

默认文件名模板：

```/dev/null/filename.txt#L1-3
{title}-{conversation_id}-{date}.{ext}
```

处理规则：

- 去除 `/ \ : * ? " < > |` 等非法字符。
- 标题过长时截断到 80 个字符。
- 空标题使用 `chatgpt-conversation`。
- 日期使用本地日期，例如 `2026-05-15`。

---

## 16. 开发目录结构建议

```/dev/null/project-tree.txt#L1-48
chatgpt-conversation-parser-extension/
├── package.json
├── wxt.config.ts
├── tsconfig.json
├── src/
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── content.ts
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   └── main.tsx
│   │   ├── sidepanel/
│   │   │   ├── index.html
│   │   │   └── main.tsx
│   │   └── options/
│   │       ├── index.html
│   │       └── main.tsx
│   ├── injected/
│   │   └── page-bridge.ts
│   ├── core/
│   │   ├── parser.ts
│   │   ├── path-resolver.ts
│   │   ├── message-filter.ts
│   │   ├── content-extractor.ts
│   │   ├── exporters/
│   │   │   ├── json-exporter.ts
│   │   │   ├── markdown-exporter.ts
│   │   │   └── text-exporter.ts
│   │   └── types.ts
│   ├── adapters/
│   │   ├── raw-json-adapter.ts
│   │   ├── share-link-adapter.ts
│   │   ├── current-page-adapter.ts
│   │   └── dom-fallback-adapter.ts
│   ├── storage/
│   │   ├── settings-store.ts
│   │   └── history-store.ts
│   ├── utils/
│   │   ├── sanitize.ts
│   │   ├── time.ts
│   │   └── filename.ts
│   └── ui/
│       ├── components/
│       └── styles/
└── tests/
    ├── fixtures/
    ├── parser.test.ts
    └── e2e/
```

---

## 17. 核心伪代码

### 17.1 解析入口

```/dev/null/parser.ts#L1-28
export function parseConversation(raw: unknown, options: ParseOptions): ConversationResult {
  const normalized = normalizeRawConversation(raw);
  const warnings: ParseWarning[] = [];

  if (!normalized.mapping) {
    throw new ParseError('MAPPING_MISSING', 'ChatGPT mapping field is missing');
  }

  const path = resolveCurrentPath(normalized.mapping, normalized.current_node, warnings);
  const messages = path
    .map((node) => extractMessage(node, normalized, warnings))
    .filter((message): message is ConversationMessage => Boolean(message))
    .filter((message) => shouldKeepMessage(message, options, warnings));

  return {
    schema_version: '1.0',
    source: options.source,
    conversation_id: normalized.conversation_id,
    title: normalized.title || 'Untitled Conversation',
    created_at: toIsoTime(normalized.create_time),
    updated_at: toIsoTime(normalized.update_time),
    default_model: normalized.default_model_slug ?? null,
    current_node: normalized.current_node ?? null,
    message_count: messages.length,
    warnings,
    messages,
  };
}
```

### 17.2 主干路径解析

```/dev/null/path-resolver.ts#L1-37
export function resolveCurrentPath(
  mapping: Record<string, MappingNode>,
  currentNode: string | null | undefined,
  warnings: ParseWarning[],
): MappingNode[] {
  const startNodeId = currentNode || inferLatestLeafNode(mapping, warnings);
  const path: MappingNode[] = [];
  const visited = new Set<string>();
  let nodeId: string | null | undefined = startNodeId;

  while (nodeId) {
    if (visited.has(nodeId)) {
      warnings.push({
        code: 'CYCLE_DETECTED',
        message: `Cycle detected at node ${nodeId}`,
        node_id: nodeId,
        severity: 'warning',
      });
      break;
    }

    const node = mapping[nodeId];
    if (!node) {
      warnings.push({
        code: 'NODE_MISSING',
        message: `Node ${nodeId} does not exist`,
        node_id: nodeId,
        severity: 'warning',
      });
      break;
    }

    visited.add(nodeId);
    path.push(node);
    nodeId = node.parent;
  }

  return path.reverse();
}
```

### 17.3 消息保留判断

```/dev/null/message-filter.ts#L1-36
export function shouldKeepMessage(
  message: ConversationMessage,
  options: ParseOptions,
): boolean {
  if (!message.content.trim()) return false;

  if (message.metadata?.is_visually_hidden_from_conversation === true) {
    return false;
  }

  if (message.role === 'system') {
    return Boolean(options.includeSystemMessages);
  }

  if (message.role === 'tool') {
    return Boolean(options.includeToolMessages);
  }

  if (message.content_type === 'user_editable_context') return false;
  if (message.content_type === 'model_editable_context') return false;

  return message.role === 'user' || message.role === 'assistant';
}
```

### 17.4 内容提取

```/dev/null/content-extractor.ts#L1-42
export function extractContent(content: unknown): ExtractedContent {
  const value = asRecord(content);
  const contentType = String(value.content_type || 'unknown');

  if (contentType === 'text' || contentType === 'multimodal_text') {
    const parts = Array.isArray(value.parts) ? value.parts : [];
    return {
      content_type: contentType,
      text: parts.map(extractPartText).filter(Boolean).join('\n\n'),
      attachments: extractAttachments(parts),
    };
  }

  if (contentType === 'code') {
    return {
      content_type: contentType,
      text: String(value.text || ''),
      language: typeof value.language === 'string' ? value.language : null,
      attachments: [],
    };
  }

  return {
    content_type: contentType,
    text: fallbackExtractText(value),
    attachments: [],
  };
}
```

---

## 18. 测试策略

### 18.1 单元测试

重点覆盖：

- `resolveCurrentPath`
- `inferLatestLeafNode`
- `shouldKeepMessage`
- `extractContent`
- `toMarkdown`
- `sanitizeFilename`
- `redactSensitiveText`

### 18.2 Fixture 回归测试

建议建立 `tests/fixtures`：

- 正常线性对话。
- 用户编辑后多分支对话。
- assistant 重新生成多分支对话。
- 包含 tool / web.run 的对话。
- 包含 `user_editable_context` 的对话。
- 包含 `code` content_type 的对话。
- 缺失 `current_node` 的对话。
- 节点断裂或循环异常样本。

### 18.3 E2E 测试

使用 Playwright 加载扩展，验证：

- popup 打开正常。
- side panel 打开正常。
- 导入 JSON 后能预览。
- 点击导出能触发下载。
- 设置项能持久化。
- 无权限时能正确提示。

---

## 19. 发布与审核注意事项

### 19.1 Chrome Web Store

需要准备：

- 插件名称和描述。
- 隐私政策页面。
- 权限用途说明。
- 截图和演示图。
- 不上传用户数据的说明。
- 如果有远程请求，必须说明目的和域名。

### 19.2 Edge Add-ons

Edge 审核关注点类似：

- 权限是否合理。
- 是否收集个人信息。
- 是否包含混淆代码。
- 是否有清晰的隐私说明。

### 19.3 版本策略

建议使用语义化版本：

- `0.1.0`：MVP，支持 JSON 导入和导出。
- `0.2.0`：支持当前页面 DOM 解析。
- `0.3.0`：支持分享链接解析。
- `0.4.0`：支持 side panel 完整预览。
- `1.0.0`：核心功能稳定，发布正式版。

---

## 20. 开发里程碑

### Milestone 1：解析核心

目标：不依赖浏览器，完成核心解析与导出。

任务：

- 定义 TypeScript 类型。
- 实现 `parseConversation`。
- 实现 JSON / Markdown / Text 导出。
- 准备 5 个以上 fixture。
- 单元测试覆盖核心分支。

验收标准：

- 给定原始 ChatGPT JSON，能输出稳定 `ConversationResult`。
- 能导出可读 Markdown。
- 异常样本不导致崩溃。

### Milestone 2：插件 MVP

目标：完成 Chrome / Edge 可运行扩展。

任务：

- 初始化 WXT 项目。
- 实现 popup 和 side panel。
- 支持导入 JSON。
- 支持预览和下载。
- 保存基础设置。

验收标准：

- 本地安装扩展后可以导入 `file.json` 并导出 Markdown。
- Chrome 和 Edge 均可运行。

### Milestone 3：当前页面解析

目标：用户打开 ChatGPT 页面后可一键导出。

任务：

- content script 识别 ChatGPT 页面。
- 实现 DOM 兜底解析。
- 尝试实现页面运行时结构化解析。
- 增加权限申请流程。

验收标准：

- 当前页面至少能导出可见对话内容。
- 结构化解析失败时有明确提示并自动兜底。

### Milestone 4：增强体验

目标：提升可用性和稳定性。

任务：

- 支持分享链接。
- 支持导出历史。
- 支持脱敏。
- 支持引用列表。
- 增加错误诊断信息。

验收标准：

- 常见分享链接可解析。
- 用户可控制导出内容范围。
- 隐私与权限说明完整。

---

## 21. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| ChatGPT 页面结构变化 | 当前页面解析失效 | Adapter 隔离 + DOM 兜底 + fixture 回归 |
| 内部 API 变化 | 精准解析失效 | 不把内部 API 作为唯一入口 |
| 权限审核不通过 | 无法上架 | 权限最小化 + 清晰隐私政策 |
| 用户对隐私担忧 | 影响使用 | 本地处理 + 不上传 + 开源核心解析 |
| 大对话性能差 | UI 卡顿 | Web Worker 解析 + 虚拟列表预览 |
| 多分支解析错误 | 导出内容不符合预期 | 默认当前分支 + UI 显示分支信息 |

---

## 22. 最终推荐方案

建议将项目定位为：

> 一个本地优先、权限最小化、可扩展适配器架构的 ChatGPT 对话导出浏览器插件。

第一版不要追求“完美读取 ChatGPT 所有内部数据”，而应优先保证：

1. JSON 导入稳定。
2. 解析核心可靠。
3. Markdown 导出好用。
4. 插件交互简单。
5. 隐私和权限可信。

随后再逐步增强当前页面解析、分享链接解析、分支可视化和批量导出。

---

## 23. 附录：实现优先级清单

### P0

- TypeScript 类型定义。
- `mapping` 主干回溯。
- 消息过滤。
- 文本提取。
- Markdown / JSON / Text 导出。
- JSON 导入 UI。
- 下载文件。

### P1

- Side Panel 预览。
- DOM 当前页面导出。
- 分享链接解析。
- 本地历史记录。
- 脱敏。
- 引用导出。

### P2

- 分支树可视化。
- HTML / PDF 导出。
- 自定义模板。
- 批量导出。
- Web Worker 性能优化。
- 开源 parser core。
