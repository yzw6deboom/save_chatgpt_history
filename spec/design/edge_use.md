# 如何在 Edge 上本地调试使用插件

## 1. 构建插件

在项目根目录执行：

```bash
npm run build
```

构建产物会生成在：

```txt
.output/chrome-mv3
```

## 2. 在 Edge 中加载未打包扩展

打开 Edge，进入：

```txt
edge://extensions
```

然后：

1. 打开左侧或右侧的 **开发人员模式 / Developer mode**
2. 点击 **加载解压缩的扩展 / Load unpacked**
3. 选择项目里的目录：

```txt
save_chatgpt_history/.output/chrome-mv3
```

4. 加载成功后，工具栏会出现插件图标

## 3. 使用插件

当前版本是 Raw JSON 导入 MVP，不会直接读取当前 ChatGPT 页面。

使用流程：

1. 点击插件图标，打开 Popup
2. 点击 **打开 Side Panel**
3. 在 Side Panel 中选择或拖拽 ChatGPT JSON 文件
4. 点击 **解析文件**
5. 查看：
   - 解析状态
   - warning 列表
   - 消息预览
   - Markdown 预览
6. 按需调整导出选项：
   - 包含时间
   - 包含模型
   - 包含引用
   - 包含基础 metadata
7. 点击：
   - **下载 .md 文件**
   - 或 **复制 Markdown**

设置页可以通过 Popup 的 **打开设置** 进入。

## 4. 开发调试模式

如果你希望边开发边调试，可以运行：

```bash
npm run dev:edge
```

然后在 Edge 的扩展页加载 WXT dev 输出目录。通常 WXT 会提示具体输出路径；如果没有提示，优先查看：

```txt
.output/edge-mv3
```

或 WXT 控制台输出的 dev build 目录。

如果只是稳定测试当前构建，建议用：

```bash
npm run build
```

然后加载：

```txt
.output/chrome-mv3
```

Edge 可以加载 Chrome MV3 扩展产物。

## 5. 查看插件错误日志

在：

```txt
edge://extensions
```

找到插件卡片：

- 点击 **详细信息 / Details**
- 查看：
  - Service Worker / background 日志
  - Popup 检查视图
  - Side Panel 页面可右键检查或通过扩展详情进入相关视图

如果 Side Panel 没打开，确认：

- Edge 版本较新
- 扩展权限包含 `sidePanel`
- 插件已重新加载最新 build

---

# 如何上架到 Microsoft Edge Add-ons

## 1. 准备生产构建

建议先构建 Edge 包：

```bash
npm run build:edge
```

然后打包：

```bash
npm run zip:edge
```

如果 `zip:edge` 成功，会生成类似：

```txt
.output/save-chatgpt-history-*-edge.zip
```

如果你使用 Chrome MV3 包也通常兼容 Edge，但上架 Edge 建议优先使用 `build:edge` / `zip:edge`。

## 2. 本地验证 ZIP 前的产物

上架前先本地加载：

```txt
.output/edge-mv3
```

或：

```txt
.output/chrome-mv3
```

确认：

- Popup 能打开
- Side Panel 能打开
- Options 能打开
- JSON 文件能解析
- Markdown 能下载
- Markdown 能复制
- 设置刷新后仍保留

## 3. 注册 Microsoft Partner Center

进入：

```txt
https://partner.microsoft.com/dashboard/microsoftedge
```

需要：

- Microsoft 账号
- 开发者注册
- 完成开发者资料
- 可能需要一次性注册费用或身份验证，具体以微软后台为准

## 4. 创建 Edge Add-ons 提交

在 Partner Center 中：

1. 创建新扩展
2. 上传 zip 包
3. 填写基本信息：
   - 名称：`Save ChatGPT History`
   - 简短描述
   - 详细描述
   - 分类
   - 语言
4. 上传图标和截图
5. 填写隐私策略 URL
6. 填写权限说明
7. 提交审核

## 5. 当前权限说明建议

当前 manifest 权限：

```json
"permissions": ["storage", "downloads", "sidePanel"]
```

可以这样解释：

- `storage`
  - 用于保存用户的 Markdown 导出偏好设置
- `downloads`
  - 用于将解析后的 Markdown 文件下载到本地
- `sidePanel`
  - 用于提供主操作界面，包括 JSON 导入、预览和导出

当前版本没有默认读取网页内容，也没有上传用户数据。

## 6. 隐私说明建议

隐私策略中建议明确：

- 插件在本地解析用户手动导入的 ChatGPT JSON 文件
- 不上传 JSON 内容
- 不发送对话内容到第三方服务器
- 不收集用户身份信息
- `chrome.storage.local` 仅保存导出选项
- 下载文件由用户主动触发并保存到本地

## 7. 审核前检查清单

提交前建议确认：

```bash
npm test
npx tsc --noEmit
npm run build:edge
npm run zip:edge
```

并手动检查：

- Edge 本地加载无报错
- 插件图标存在
- Popup 可用
- Side Panel 可用
- Options 可用
- 下载权限正常
- 不申请多余权限
- 描述中不要宣称尚未实现的“自动读取当前 ChatGPT 页面”能力

当前版本应描述为：

> 导入 ChatGPT 原始 JSON 文件，并在本地解析、预览、导出 Markdown。

不要描述成：

> 自动抓取当前 ChatGPT 页面历史记录。

因为当前页面解析属于后续 Milestone。
