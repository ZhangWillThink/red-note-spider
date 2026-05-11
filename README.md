# Spider XHS (Bun/TypeScript 版)

[![npm](https://img.shields.io/npm/v/spider-xhs-bun.svg)](https://www.npmjs.com/package/spider-xhs-bun)
[![GitHub Repo](https://img.shields.io/badge/GitHub-red--note--spider-181717?logo=github)](https://github.com/ZhangWillThink/red-note-spider)

小红书 PC Web 端爬虫，Bun + TypeScript 实现

- **源码仓库**：[github.com/ZhangWillThink/red-note-spider](https://github.com/ZhangWillThink/red-note-spider)
- **npm 包**：[spider-xhs-bun](https://www.npmjs.com/package/spider-xhs-bun)（运行仍需本机安装 [Bun](https://bun.sh/) >= 1.0）

> **给 AI 看的：** 请先阅读 [`skills/SKILL.md`](./skills/SKILL.md)

## 免责声明

- **小红书平台禁止未经授权的数据爬取**。请遵守小红书用户协议、服务条款及相关法律法规。
- **本仓库仅作技术交流与代码参考**，不鼓励、不协助任何侵犯平台权益或第三人权益的行为。
- 请勿将本项目用于未经许可的商用、规模化抓取或其他违规用途。**因使用本项目而产生的任何法律责任与后果，均由使用者自行承担**，与仓库作者及维护者无关。

## 功能特性

- 🔍 **笔记搜索**：按关键词搜索笔记，支持排序、筛选
- 👤 **用户作品**：爬取指定用户的所有笔记
- 📝 **笔记详情**：获取单篇笔记的详细信息
- 📥 **媒体下载**：支持图片、视频下载，自动处理 WSL DNS 问题
- 📊 **Excel 导出**：将爬取数据导出为 Excel 格式
- ⚡ **性能与健壮性**：基于 Bun 运行时；媒体下载与**多篇笔记详情**（`feed`）均可限流并发；Edith API 支持**退避重试**与可选**请求间隔**，降低弱网失败率与触发风控的概率

## 环境要求

- [Bun](https://bun.sh/) >= 1.0
- 有效的小红书账号 Cookies

## 安装

### 从 npm 安装

```bash
# 全局安装（推荐用 Bun 安装，也可用 npm）
bun add -g spider-xhs-bun
# 或
npm install -g spider-xhs-bun
```

安装后可用全局命令：

| 命令                    | 说明                                           |
| ----------------------- | ---------------------------------------------- |
| `spider-xhs-bun`        | 主 CLI，子命令：`note`、`user`、`search`       |
| `spider-xhs-bun-cookie` | 交互式保存 Cookie（默认写入本机状态目录，见下表） |

不全局安装时，可在项目目录用 **`bunx spider-xhs-bun`**（或 `bun x spider-xhs-bun`）代替下面的 `spider-xhs-bun`，例如：

```bash
bunx spider-xhs-bun note --url "https://www.xiaohongshu.com/explore/..."
```

下文「使用方法」中的 **`bun run …`** 表示**从本仓库源码**运行时；若使用 npm 全局 CLI，请把 `bun run note` / `bun run user` / `bun run search` 换成 **`spider-xhs-bun note`** 等形式。

### 从源码安装

```bash
git clone https://github.com/ZhangWillThink/red-note-spider.git
cd red-note-spider

bun install
```

## 获取 Cookies

1. 浏览器访问 [小红书](https://www.xiaohongshu.com) 并登录
2. 按 F12 打开开发者工具，切换到 Network 面板
3. 刷新页面，找到任意请求，复制 Request Headers 中的 `Cookie` 字段
4. 运行 `spider-xhs-bun-cookie`（npm 全局）或 `bun cookie`（本仓库源码），按提示粘贴 Cookie

## 使用方法

### 爬取单篇/多篇笔记

```bash
# 爬取单篇笔记（同时下载媒体和导出 Excel）
bun run note --url "https://www.xiaohongshu.com/explore/笔记ID?xsec_token=xxx"

# 爬取多篇笔记（逗号分隔）
bun run note --url "url1,url2,url3" --name "我的笔记"

# 只下载媒体文件
bun run note --url "url1" --save media

# 只下载视频
bun run note --url "url1" --save media-video

# 只导出 Excel
bun run note --url "url1" --save excel --name "笔记数据"
```

### 爬取用户所有笔记

```bash
# 爬取指定用户的所有笔记
bun run user --url "https://www.xiaohongshu.com/user/profile/用户ID?xsec_token=xxx"

# 只导出 Excel
bun run user --url "用户主页URL" --save excel
```

### 搜索笔记

```bash
# 搜索关键词（默认返回 20 条）
bun run search --query "小红书爬虫"

# 指定返回数量
bun run search --query "TypeScript" --num 50

# 按最新排序
bun run search --query "Bun" --sort 1

# 只看视频笔记
bun run search --query "教程" --noteType 1

# 一周内的内容
bun run search --query "新闻" --noteTime 2
```

#### 排序选项（--sort）

- `0` - 综合（默认）
- `1` - 最新
- `2` - 最多点赞
- `3` - 最多评论
- `4` - 最多收藏

#### 笔记类型（--noteType）

- `0` - 不限（默认）
- `1` - 视频
- `2` - 普通（图文）

#### 时间范围（--noteTime）

- `0` - 不限（默认）
- `1` - 一天内
- `2` - 一周内
- `3` - 半年内

### 配置 Cookies 与目录规范

`spider-xhs-bun-cookie`（或 `bun cookie`）会把 Cookie 写入 **本机状态目录**下的 `cookies.txt`，不依赖当前工作目录（便于全局安装 CLI 后在任意目录执行爬取）。

| 用途           | 默认位置                                                                                                                              | 覆盖方式                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Cookie 文件    | Linux/macOS：`~/.local/state/spider-xhs-bun/cookies.txt`（遵循 `$XDG_STATE_HOME`）<br>Windows：`%APPDATA%\spider-xhs-bun\cookies.txt` | `XHS_STATE_DIR`（状态根目录）<br>`XHS_COOKIES_FILE`（文件完整路径） |
| 爬取输出根目录 | 未传 `--out` 时：环境变量 `XHS_DATA_DIR`；再否则为**当前目录**下的 `./datas`                                                          | 子命令参数 `--out`<br>或设置 `XHS_DATA_DIR`                         |

**读取 Cookie 的查找顺序**（命中即停）：`--cookies` 内联 → `XHS_COOKIES_FILE` 指向的文件 → 当前目录 `./cookies.txt` → 上一级 `../cookies.txt` → 上表默认 Cookie 路径。

> **从旧行为升级**：此前若只在「某一固定目录」靠 `cookies.txt` 工作，请在该目录下执行爬取，或把该文件路径设为 `XHS_COOKIES_FILE`，或重新运行一次 `spider-xhs-bun-cookie` 写入状态目录（之后任意目录可用）。

首次使用或 Cookie 失效后：

```bash
spider-xhs-bun-cookie
# 或从源码：bun cookie
```

也可以临时通过参数传入：

```bash
spider-xhs-bun note --url "url" --cookies "你的cookies字符串"
# 或从源码：bun run note --url "url" --cookies "..."
```

### 出现「无登录信息，或登录信息为空」时

接口需要**带完整登录态**的 Cookie。请确认复制的 Cookie 里包含 **`web_session`**（以及浏览器里与登录相关的字段）。

- 在开发者工具 **Network** 中筛选 **Fetch/XHR**，点选发往 **`edith.xiaohongshu.com`**（或主站下的 API）的请求，再复制 **Request Headers → Cookie**，不要只挑静态资源、打点类请求。
- 若使用仓库内的 `./cookies.txt`，请保证在该文件所在目录下执行命令，或使用 `--cookies` / `XHS_COOKIES_FILE` 指向正确文件。

## 环境变量

### 路径与下载

| 变量名                     | 说明                                        | 默认值 / 行为        |
| -------------------------- | ------------------------------------------- | -------------------- |
| `XHS_STATE_DIR`            | 状态根目录（Cookie 默认在 `…/cookies.txt`） | 见上表               |
| `XHS_COOKIES_FILE`         | Cookie 文件路径                             | 见上表               |
| `XHS_DATA_DIR`             | 爬取结果根目录（未传 `--out` 时）           | 未设置则用 `./datas` |
| `XHS_DOWNLOAD_CONCURRENCY` | 媒体下载并发数                              | `6`                  |
| `XHS_DOWNLOAD_CONNECT_MS`  | 下载连接超时(ms)                            | `15000`              |
| `XHS_DOWNLOAD_IDLE_MS`     | 图片下载空闲超时(ms)                        | `15000`              |
| `XHS_VIDEO_IDLE_MS`        | 视频下载空闲超时(ms)                        | `30000`              |

### Edith API（`src/apis/pc.ts`）与多篇笔记抓取

多篇笔记、`user`、`search` 都会多次请求 `edith.xiaohongshu.com`。可通过下列变量调节并发、间隔与重试。以下变量与 Cookie 无关；**请勿将 Cookie 写入 `.env` 或提交到仓库**。

| 变量名                         | 说明                                                                 | 默认   |
| ------------------------------ | -------------------------------------------------------------------- | ------ |
| `XHS_NOTE_FETCH_CONCURRENCY`   | 并行请求笔记详情接口（`feed`）的并发上限；单条 URL 仍一次请求           | `6`    |
| `XHS_REQUEST_DELAY_MS`         | 每次 Edith API 调用**结束后**额外等待的毫秒数（用户分页、搜索翻页等均生效） | `0`（不延迟） |
| `XHS_API_MAX_RETRIES`          | 失败后的**额外**重试次数（不含首次请求）；对网络错误及部分 HTTP 状态退避 | `2`（最多共 3 次请求） |
| `XHS_API_RETRY_BASE_MS`        | 重试间隔基数：`基数 × 重试序号`，单位 ms                             | `1500` |

可重试的 HTTP 状态包括：`429`、`460`、`500`、`502`、`503`、`504`。CLI 的版本号与 **npm/package.json** 中的 `version` 一致。

## 输出目录

下方 `(输出根)/` 默认为 `./datas`，或通过 `--out` / `XHS_DATA_DIR` 指定。

```
(输出根)/
├── media_datas/        # 媒体文件（图片、视频）
│   └── 昵称_用户ID/
│       └── 标题_笔记ID/
│           ├── info.json      # 笔记原始信息
│           ├── detail.txt    # 笔记详细信息文本
│           ├── image_0.jpg   # 图片文件
│           ├── video.mp4     # 视频文件
│           └── cover.jpg     # 视频封面
└── excel_datas/        # Excel 导出文件
    └── *.xlsx
```

## 项目结构

```
red-note-spider/
├── src/
│   ├── apis/              # API 接口封装
│   │   ├── pc.ts          # 小红书 PC Web API
│   │   └── headers.ts     # 请求头生成
│   ├── sign/              # 签名模块
│   │   └── index.ts       # X-S、X-S-Common 签名
│   ├── utils/             # 工具函数
│   │   ├── cookie.ts      # Cookie 解析
│   │   ├── xhs-paths.ts   # 状态目录、Cookie/输出路径
│   │   ├── data.ts        # 数据处理
│   │   ├── download.ts    # 媒体下载
│   │   ├── limiter.ts     # 并发限流（下载与多篇笔记 feed 共用）
│   │   └── excel.ts       # Excel 导出
│   ├── cli/
│   │   └── index.ts       # CLI 入口（citty）
│   └── smoke.ts           # 签名模块冒烟测试
├── static/                # 静态资源（签名JS）
├── cookies.txt            # 可选：放在项目根时参与查找（见上文顺序，不提交）
├── .env.example           # 下载相关环境变量示例
├── package.json
└── tsconfig.json
```

## 注意事项

1. **Cookies 有效性**：Cookies 失效会导致 460 等错误，需定期更新
2. **反爬限制**：请合理控制爬取频率，避免账号被限制
3. **WSL 用户**：项目已处理 WSL 下 xhscdn DNS 解析问题，无需额外配置
4. **仅供参考与学习**：使用前请再次阅读上文 [免责声明](#免责声明)，并严格遵守法律法规与平台规则

## 开发

```bash
# 类型检查
bun run typecheck

# 签名模块测试
bun run src/smoke.ts

# 使用 tsx 开发（如果不用 Bun）
npx tsx src/cli/index.ts note --url "..."
```

## 开源许可

本项目采用 **[MIT License](https://opensource.org/licenses/MIT)** 授权，许可全文见仓库根目录 [`LICENSE`](./LICENSE)。
