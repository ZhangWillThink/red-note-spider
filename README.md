# Spider XHS (Bun/TypeScript 版)

小红书 PC Web 端爬虫，Bun + TypeScript 实现，基于 [Spider_XHS](https://github.com/NanmiCoder/Spider_XHS) Python 版本移植。

## 功能特性

- 🔍 **笔记搜索**：按关键词搜索笔记，支持排序、筛选
- 👤 **用户作品**：爬取指定用户的所有笔记
- 📝 **笔记详情**：获取单篇笔记的详细信息
- 📥 **媒体下载**：支持图片、视频下载，自动处理 WSL DNS 问题
- 📊 **Excel 导出**：将爬取数据导出为 Excel 格式
- ⚡ **高性能**：基于 Bun 运行时，支持并发下载控制

## 环境要求

- [Bun](https://bun.sh/) >= 1.0
- 有效的小红书账号 Cookies

## 安装

```bash
# 克隆项目
git clone https://github.com/NanmiCoder/Spider_XHS.git
cd Spider_XHS/spider-xhs-bun

# 安装依赖
bun install
```

## 获取 Cookies

1. 浏览器访问 [小红书](https://www.xiaohongshu.com) 并登录
2. 按 F12 打开开发者工具，切换到 Network 面板
3. 刷新页面，找到任意请求，复制 Request Headers 中的 `Cookie` 字段
4. 运行 `bun cookie`，按提示粘贴 Cookie

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

### 配置 Cookies

首次使用或 Cookie 失效后，运行：

```bash
bun cookie
```

该命令会把 Cookie 保存到本地 `cookies.txt`，后续 `note`、`user`、`search` 命令会自动读取。

也可以临时通过参数传入：

```bash
bun run note --url "url" --cookies "你的cookies字符串"
```

## 环境变量

| 变量名                     | 说明                 | 默认值  |
| -------------------------- | -------------------- | ------- |
| `XHS_DOWNLOAD_CONCURRENCY` | 媒体下载并发数       | `6`     |
| `XHS_DOWNLOAD_CONNECT_MS`  | 下载连接超时(ms)     | `15000` |
| `XHS_DOWNLOAD_IDLE_MS`     | 图片下载空闲超时(ms) | `15000` |
| `XHS_VIDEO_IDLE_MS`        | 视频下载空闲超时(ms) | `30000` |

## 输出目录

```
datas/
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
spider-xhs-bun/
├── src/
│   ├── apis/              # API 接口封装
│   │   ├── pc.ts          # 小红书 PC Web API
│   │   └── headers.ts     # 请求头生成
│   ├── sign/              # 签名模块
│   │   └── index.ts       # X-S、X-S-Common 签名
│   ├── utils/             # 工具函数
│   │   ├── cookie.ts      # Cookie 解析
│   │   ├── data.ts        # 数据处理
│   │   ├── download.ts    # 媒体下载
│   │   └── excel.ts       # Excel 导出
│   ├── cli/
│   │   └── index.ts       # CLI 入口（citty）
│   └── smoke.ts           # 签名模块冒烟测试
├── static/                # 静态资源（签名JS）
├── cookies.txt            # 本地 Cookie（运行 bun cookie 生成，不提交）
├── .env.example           # 下载相关环境变量示例
├── package.json
└── tsconfig.json
```

## 注意事项

1. **Cookies 有效性**：Cookies 失效会导致 460 等错误，需定期更新
2. **反爬限制**：请合理控制爬取频率，避免账号被限制
3. **WSL 用户**：项目已处理 WSL 下 xhscdn DNS 解析问题，无需额外配置
4. **仅用于学习交流**：请遵守相关法律法规和平台规则

## 与 Python 版对比

| 特性        | Python 版        | Bun/TS 版                    |
| ----------- | ---------------- | ---------------------------- |
| 运行时      | Python 3.8+      | Bun 1.0+                     |
| 依赖管理    | requirements.txt | package.json                 |
| HTTP 客户端 | requests         | Bun fetch                    |
| 签名实现    | PyExecJS         | Bun vm (已改为 new Function) |
| CLI 框架    | argparse         | citty                        |
| Excel 导出  | openpyxl         | exceljs                      |

## 开发

```bash
# 类型检查
bun run typecheck

# 签名模块测试
bun run src/smoke.ts

# 使用 tsx 开发（如果不用 Bun）
npx tsx src/cli/index.ts note --url "..."
```

## License

MIT

## 参考

- [Spider_XHS (Python 原版)](https://github.com/NanmiCoder/Spider_XHS)
- [小红书 PC Web](https://www.xiaohongshu.com)
