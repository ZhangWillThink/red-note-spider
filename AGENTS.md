# AGENTS.md - AI 助手项目指南

本项目是小红书爬虫的 Bun/TypeScript 实现，基于 Python 版本 [Spider_XHS](https://github.com/NanmiCoder/Spider_XHS) 移植。

## 项目概述

- **语言**: TypeScript (严格模式)
- **运行时**: Bun >= 1.0
- **CLI 框架**: citty
- **主要功能**: 爬取小红书笔记、用户作品，支持搜索、媒体下载、Excel 导出

## 技术栈

- `bun` - 运行时、包管理器、测试运行器
- `citty` - CLI 框架
- `consola` - 美观的日志输出
- `exceljs` - Excel 文件生成
- `crypto-js` - 加密相关（可能在签名中使用）

## 开发命令

```bash
bun install          # 安装依赖
bun run dev          # 开发模式（等同 bun run note）
bun run note         # 爬取笔记
bun run user         # 爬取用户作品
bun run search       # 搜索笔记
bun run typecheck    # TypeScript 类型检查
bun run lint         # ESLint 代码检查
```

## 代码结构

```
src/
├── cli/index.ts       # CLI 入口，定义命令和参数
├── apis/
│   ├── pc.ts         # 小红书 PC Web API 封装
│   └── headers.ts    # 请求头生成（含签名）
├── sign/
│   └── index.ts      # X-S、X-S-Common 签名（加载外部 JS）
├── utils/
│   ├── cookie.ts    # Cookie 解析/序列化
│   ├── xhs-paths.ts # 状态目录、Cookie 路径、输出目录（XHS_*）
│   ├── data.ts       # 数据处理、类型定义
│   ├── download.ts  # 媒体下载（含 DNS 修复、并发控制）
│   └── excel.ts     # Excel 导出
├── smoke.ts          # 签名模块测试
└── smoke-eval.ts     # 签名评估测试
```

## 重要约定

### 1. 签名机制

- 签名逻辑在 `static/xhs_main_260411.js` 和 `static/xhs_xray.js` 中
- `src/sign/index.ts` 使用 `new Function()` 在主进程执行签名 JS
- **不要修改签名 JS 文件**，它们是小红书官方的混淆代码
- 签名需要 `a1` 字段（从 cookies 中获取）

### 2. WSL DNS 问题

- xhscdn 子域在 WSL 下会卡住
- `download.ts` 中使用 `Bun.dns.lookup({family: 4})` 预先解析 IPv4
- 通过 IP 直连 + Host 头绕过 DNS 问题

### 3. 并发控制

- 媒体下载使用 `createLimiter()` 控制并发（默认 6，可通过 `XHS_DOWNLOAD_CONCURRENCY` 调整）
- 搜索有最大页数限制（默认 50 页，防止死循环）

### 4. Cookie、状态目录与输出目录

- Cookie **不写进 `.env`**，逻辑在 `src/utils/xhs-paths.ts`：默认写入 **`$XDG_STATE_HOME/spider-xhs-bun/cookies.txt`**（一般为 `~/.local/state/spider-xhs-bun/cookies.txt`），Windows 为 `%APPDATA%/spider-xhs-bun/cookies.txt`。
- 可用 **`XHS_STATE_DIR`**、**`XHS_COOKIES_FILE`** 覆盖路径；CLI 读取顺序：--cookies → `XHS_COOKIES_FILE` 文件 → 当前目录 `./cookies.txt` → 上一级 `../cookies.txt` → 上述默认 Cookie 文件。
- 爬取结果根目录：**`--out`** 优先，否则 **`XHS_DATA_DIR`**，否则当前目录下 **`./datas`**。
- 项目根目录下的 `cookies.txt` 仍可用于仓库内开发（已加入 `.gitignore`）。

环境变量（下载相关）：

| 变量                       | 说明             | 必需                |
| -------------------------- | ---------------- | ------------------- |
| `XHS_STATE_DIR`           | 状态根目录（Cookie 默认存其下） | ❌ |
| `XHS_COOKIES_FILE`        | Cookie 文件完整路径 | ❌ |
| `XHS_DATA_DIR`            | 爬取输出根目录（未传 `--out` 时） | ❌ |
| `XHS_DOWNLOAD_CONCURRENCY` | 下载并发数       | ❌ 否（默认 6）     |
| `XHS_DOWNLOAD_CONNECT_MS`  | 连接超时(ms)     | ❌ 否（默认 15000） |
| `XHS_DOWNLOAD_IDLE_MS`     | 图片空闲超时(ms) | ❌ 否（默认 15000） |
| `XHS_VIDEO_IDLE_MS`        | 视频空闲超时(ms) | ❌ 否（默认 30000） |

### 5. 日志规范

- ✅ 使用 `consola`（已配置）
- ❌ 避免使用 `console.log/warn/error`（ESLint 会警告）
- 允许使用 `console` 的 `warn`、`error`、`info` 方法（配置中已豁免）

### 6. 类型安全

- 项目启用了 TypeScript 严格模式
- 存在 `any` 类型的地方会触发 ESLint 警告（@typescript-eslint/no-explicit-any）
- 新代码尽量避免使用 `any`，对于外部 API 响应可逐步添加类型定义

## 常见任务指南

### 添加新的 CLI 命令

1. 在 `src/cli/index.ts` 中使用 `defineCommand()` 定义新命令
2. 在 `main` 命令的 `subCommands` 中注册
3. 参数定义使用 `args` 对象，支持 `positional` 和命名参数

### 修改 API 调用

1. API 封装在 `src/apis/pc.ts`
2. 需要签名的请求使用 `buildRequest()` 生成 headers
3. 签名函数来自 `src/sign/index.ts`

### 处理媒体下载

1. 下载逻辑在 `src/utils/download.ts`
2. 使用 `downloadMedia()` 下载单个文件
3. 支持重试（默认 3 次）
4. 图片扩展名固定为 `jpg`，视频为 `mp4`

### 数据导出

1. Excel 导出使用 `src/utils/excel.ts` 的 `saveToXlsx()`
2. 支持三种类型：`note`、`user`、`comment`（对应不同表头）
3. 使用 `exceljs` 库生成 `.xlsx` 文件

## 注意事项

1. **Cookies 安全性**：不要在代码中硬编码 cookies；使用 `spider-xhs-bun-cookie` / `bun cookie` 写入本机状态目录或 `XHS_COOKIES_FILE`；仓库内可选用 `./cookies.txt`（已加入 `.gitignore`）
2. **反爬限制**：控制爬取频率，避免账号被封
3. **签名失效**：如果请求返回 460 错误，通常是 cookies 或签名失效，需要更新 cookies
4. **法律合规**：仅用于学习交流，遵守相关法律法规和小红书平台规则
5. **静态文件**：`static/` 目录下的 JS 文件是签名脚本，不要提交修改

## 调试技巧

### 测试签名模块

```bash
bun run src/smoke.ts
```

输出 `xs`、`xt`、`xs_common` 等签名值，用于验证签名是否正常。

### 查看详细日志

项目中使用了 `consola`，支持不同的日志级别：

- `consola.info()` - 信息
- `consola.success()` - 成功
- `consola.warn()` - 警告
- `consola.error()` - 错误

### 检查网络请求

可以使用浏览器开发者工具查看小红书实际发送的请求，对比项目中的实现。

## 代码风格

- 缩进：2 空格
- 引号：单引号 `''`
- 分号：可选（Bun/TypeScript 推荐不加）
- 行尾：无尾随空格
- 文件尾：保留一个换行符

格式化工具：Prettier（配置在 `.prettierrc`）

## 相关文档

- [本机执行 Agent 技能](.cursor/skills/local-computer-agent/SKILL.md) — 终端、Git、`gh`、代理与验证习惯（给在本机代跑命令的 AI 用）
- [项目 README](./README.md) - 使用说明
- [Spider_XHS Python 版](https://github.com/NanmiCoder/Spider_XHS) - 原始项目
- [Bun 文档](https://bun.sh/docs) - 运行时文档
- [小红书 PC Web](https://www.xiaohongshu.com) - 目标网站
