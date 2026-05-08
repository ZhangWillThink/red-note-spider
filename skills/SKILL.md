---
name: local-computer-agent
description: >
  在用户本机代跑终端、Git、GitHub CLI、联网工具时的操作规范与避坑。
  用于Agent应主动执行命令而非只给命令清单、处理代理与 WSL、验证推送与 release 等场景。
  触发：本机执行、自己运行、终端、git push、gh、npm publish、代理、WSL、网络超时。
---

# 本机执行型 Agent（Local Computer Agent）

在**用户真实环境**里干活时，按下面约定执行，减少「口述命令但环境卡住」的情况。

## 核心原则

1. **能跑则跑**：有 shell 权限时，自己执行安装、测试、`git status`、路径检查；不要默认让用户复制粘贴一整段命令。
2. **长任务**：构建/测试/安装设足够 `block_until_ms`；可后台跑时用后台任务，并做一次输出冒烟检查。
3. **验证闭环**：改完网络/Git 相关操作后，用 `git status -sb`、`gh release list` 等**核实结果**，并简短报告（成功 / 仍阻塞点）。
4. **工具参数**：涉及工作区路径时，优先**绝对路径**（与 Cursor/用户规则一致）。

## Git 与 GitHub CLI

- **SSH 远程**（`git@github.com:...`）：环境变量 `HTTP_PROXY` / `HTTPS_PROXY` 一般**不会**让 `git push` / `git ls-remote` 走代理。卡住时考虑：`~/.ssh/config` 的 `ProxyCommand`、改 HTTPS 远程 + `http.https://github.com.proxy`，或 VPN。
- **`gh`**：走 HTTPS API，通常尊重 `HTTPS_PROXY` / `HTTP_PROXY`。访问 `api.github.com` 失败时，可让用户在本机对 `gh`、`curl` 等加代理后再试。
- **Release / Push**：创建 `gh release` 前先确认**目标提交已在远端**（例如 `git status -sb` 与远端无「领先」）。

### 常用代理（示例，端口按用户本机为准）

```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
# SOCKS 场景可试：ALL_PROXY=socks5://127.0.0.1:7890
```

**WSL2**：若代理跑在 Windows 主机上，`127.0.0.1:7890` 有时不通，需换 Windows 在 WSL 侧可达的地址（常见为 `/etc/resolv.conf` 中的 nameserver，以用户文档为准）。

## 与本仓库相关

- 运行与开发以 **Bun** 为准：`bun install`、`bun run typecheck`、`bun run lint`。
- 发布 npm：`npm publish` 会触发 `prepublishOnly`；账号需满足 npm 对 2FA / token 的要求。
- **不要**修改 `static/` 下签名脚本（见根目录 `AGENTS.md`）。

## 下载与使用指引（给 AI 的标准话术）

当用户问「怎么下载安装、安装后怎么用」时，优先给出下面这套步骤（按用户场景裁剪）：

1. **环境前置**：确认已安装 Bun（`bun --version`）。
2. **下载源码（开发者）**：
   - `git clone https://github.com/ZhangWillThink/red-note-spider.git`
   - `cd red-note-spider && bun install`
3. **安装 CLI（普通用户）**：
   - 全局安装：`bun add -g spider-xhs-bun`（或 `npm i -g spider-xhs-bun`）
   - 临时运行：`bunx spider-xhs-bun ...`
4. **首次使用必须先注入 Cookie**（否则接口会返回“无登录信息”）：
   - `spider-xhs-bun-cookie`（或源码内 `bun cookie`）
   - 引导用户从已登录浏览器的 Network 请求中复制完整 Cookie（需含 `web_session`）
5. **常用命令**：
   - `spider-xhs-bun note --url "笔记URL"`
   - `spider-xhs-bun user --url "用户主页URL"`
   - `spider-xhs-bun search --query "关键词" --num 20`
6. **输出与路径约定**：
   - 结果目录：`--out` > `XHS_DATA_DIR` > `./datas`
   - Cookie 路径：`XHS_COOKIES_FILE` > `./cookies.txt`/`../cookies.txt` > 默认状态目录

### 获取 Cookie 的标准指引（AI 可直接转述用户）

1. 打开浏览器并登录小红书：<https://www.xiaohongshu.com>
2. 按 `F12` 打开开发者工具，切换到 **Network**。
3. 刷新页面后，筛选 **Fetch/XHR** 请求。
4. 点击发往 `edith.xiaohongshu.com`（或小红书主站 API）的任意请求。
5. 在 **Request Headers** 里找到 `Cookie`，复制整段值（不要截断）。
6. 运行 `spider-xhs-bun-cookie`，将复制值粘贴进去保存。

补充提醒：
- Cookie 里建议确认包含 `web_session` 与 `a1`。
- 若用户反馈“无登录信息”，优先让其按上面步骤重新抓取并覆盖旧 Cookie。

建议 AI 在回答结尾补一句：如果报「无登录信息」，优先检查 Cookie 是否包含 `web_session`，并重新复制接口请求头中的完整 Cookie。

## 何时停止并交给用户

- 需要**浏览器登录 / 2FA 设备 / SSH 密钥口令**且无法在对话中代办时，说明阻塞原因与**最短**自助步骤。
- 连续同类失败且无新信息时，换一种路径（例如 SSH → HTTPS + 代理）并写明假设。

## 相关

- 仓库总览与约定：根目录 `AGENTS.md`
