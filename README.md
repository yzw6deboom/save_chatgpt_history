# Save ChatGPT History

一个用于将 ChatGPT 对话导出为 Markdown 的浏览器插件项目。

当前阶段只完成了插件开发框架搭建，尚未实现实际业务功能。

## 技术栈

- WXT
- React
- TypeScript
- Tailwind CSS
- Vitest
- Manifest V3

## 可用脚本

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

启动 Edge 开发模式：

```bash
npm run dev:edge
```

构建 Chrome 版本：

```bash
npm run build
```

构建 Edge 版本：

```bash
npm run build:edge
```

运行测试：

```bash
npm run test
```

## Edge 本地加载调试

先构建 Edge 版本：

```bash
npm run build:edge
```

然后打开 Edge 扩展管理页面：

```txt
edge://extensions/
```

开启「开发人员模式」，点击「加载解压缩的扩展」，选择以下目录：

```txt
.output/edge-mv3
```

## 当前项目状态

已完成：

- WXT + React + TypeScript 工程初始化；
- Manifest V3 基础配置；
- Popup 占位页面；
- Side Panel 占位页面；
- Options 占位页面；
- Tailwind CSS 配置；
- Vitest 测试配置；
- Edge / Chrome 构建脚本；
- 测试 fixture 目录。

尚未实现：

- JSON 文件导入；
- ChatGPT 对话解析；
- 对话预览；
- Markdown 导出；
- Markdown 下载；
- 当前页面解析；
- 接口 response 获取。

## 第一版目标

第一版只聚焦核心能力：

1. 用户导入 ChatGPT 原始 JSON 文件；
2. 插件解析 `mapping + current_node` 对话主干；
3. 在 Side Panel 中预览解析结果；
4. 导出标准 Markdown 文件；
5. 支持 Edge 浏览器本地加载、调试，并为后续上架做准备。

暂不实现历史记录、脱敏、分享链接解析、当前页面解析、JSON / Text / HTML / PDF 导出等增强功能。
