#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import consola from 'consola'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { SearchOptions } from '../apis/pc.ts'

import { getNoteInfo, getUserAllNotes, searchSomeNote } from '../apis/pc.ts'
import { parseCookies } from '../utils/cookie.ts'
import { handleNoteInfo, type NoteInfo } from '../utils/data.ts'
import { downloadNote, ensureDir, type SaveChoice } from '../utils/download.ts'
import { saveToXlsx } from '../utils/excel.ts'

type BasePath = { media: string; excel: string }

/** PC Web 接口通常需要带登录态；缺少时服务端会返回「无登录信息」类错误 */
function warnIfCookieMissingSession(cookiesStr: string): void {
  const c = parseCookies(cookiesStr)
  if (c.web_session?.trim()) return
  consola.warn(
    '当前 Cookie 中未检测到 web_session，接口可能返回「无登录信息」。' +
      '请在已登录状态下，从 Network 里选发往 www.xiaohongshu.com 或 edith.xiaohongshu.com 的 XHR/Fetch，复制完整 Cookie（需含 web_session）。',
  )
}

/** 从命令行或 `bun cookie` / `spider-xhs-bun-cookie` 写入的本地文件读取 cookies */
async function resolveCookies(input?: string): Promise<string> {
  if (input && input.trim()) {
    const s = input.trim()
    warnIfCookieMissingSession(s)
    return s
  }
  for (const p of ['cookies.txt', '../cookies.txt']) {
    try {
      const txt = await readFile(p, 'utf8')
      const first = txt.split('\n').find((l) => l.trim())
      if (first) {
        const s = first.trim()
        warnIfCookieMissingSession(s)
        return s
      }
    } catch {
      // ignore
    }
  }
  throw new Error(
    '未找到 cookies！\n' +
      '请通过以下任一方式提供：\n' +
      '  1. 运行 spider-xhs-bun-cookie（或 bun cookie），按提示粘贴 Cookie\n' +
      '  2. 使用 --cookies "cookies字符串" 参数临时传入\n\n' +
      '获取 cookies 方法：\n' +
      '  1. 浏览器访问 https://www.xiaohongshu.com 并登录\n' +
      '  2. 按 F12 打开开发者工具 → Network 面板\n' +
      '  3. 刷新页面，找到发往 edith.xiaohongshu.com（或主站 API）的请求，复制 Request Headers 中的完整 Cookie\n' +
      '  详情请查看 README.md',
  )
}

function defaultBasePath(dir?: string): BasePath {
  const base = resolve(dir ?? './datas')
  return { media: `${base}/media_datas`, excel: `${base}/excel_datas` }
}

function resolveUrlInput(input?: string): string {
  const value = input?.trim()
  if (!value) {
    throw new Error('缺少 URL，请使用 --url 传入')
  }
  return value
}

function normalizeLegacyUrlArg(argv: string[]): string[] {
  const [subCommand, firstArg, ...rest] = argv
  if (!subCommand || !['note', 'user'].includes(subCommand)) {
    return argv
  }
  if (!firstArg || firstArg.startsWith('-')) {
    return argv
  }
  return [subCommand, `--url=${firstArg}`, ...rest]
}

/** 核心流程：给一组 note_url，调用 feed 接口解析后批量下载/导出 Excel */
async function spiderSomeNote(
  noteUrls: string[],
  cookiesStr: string,
  base: BasePath,
  saveChoice: SaveChoice,
  excelName: string,
): Promise<void> {
  if ((saveChoice === 'all' || saveChoice === 'excel') && !excelName) {
    throw new Error('excel_name 不能为空')
  }
  const notes: NoteInfo[] = []
  for (const url of noteUrls) {
    const res = await getNoteInfo(url, cookiesStr)
    if (!res.success) {
      consola.warn(`get_note_info 失败 ${url}: ${res.msg}`)
      continue
    }
    const item = res.data?.data?.items?.[0]
    if (!item) {
      consola.warn(`无数据 ${url}`)
      continue
    }
    item.url = url
    notes.push(handleNoteInfo(item))
    consola.success(`已解析 ${url}`)
  }

  if (saveChoice === 'all' || saveChoice.startsWith('media')) {
    await ensureDir(base.media)
    for (const n of notes) {
      const path = await downloadNote(n, base.media, saveChoice)
      consola.info(`已保存 → ${path}`)
    }
  }
  if (saveChoice === 'all' || saveChoice === 'excel') {
    await ensureDir(base.excel)
    const file = resolve(base.excel, `${excelName}.xlsx`)
    await saveToXlsx(
      notes as unknown as Record<string, unknown>[],
      file,
      'note',
    )
    consola.success(`Excel 保存至 ${file}`)
  }
}

const noteCmd = defineCommand({
  meta: {
    name: 'note',
    description: '爬取一个或多个笔记 URL',
  },
  args: {
    url: {
      type: 'string',
      description: '笔记 URL（多个用逗号分隔）',
      required: true,
    },
    cookies: { type: 'string', description: 'cookies 字符串' },
    save: {
      type: 'string',
      description: 'all | media | media-image | media-video | excel',
      default: 'all',
    },
    name: {
      type: 'string',
      description: 'Excel 文件名（不含扩展名）',
      default: 'notes',
    },
    out: { type: 'string', description: '输出根目录', default: './datas' },
  },
  async run({ args }) {
    const cookiesStr = await resolveCookies(args.cookies)
    const urls = resolveUrlInput(args.url)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    await spiderSomeNote(
      urls,
      cookiesStr,
      defaultBasePath(args.out),
      args.save as SaveChoice,
      args.name,
    )
  },
})

const userCmd = defineCommand({
  meta: {
    name: 'user',
    description: '爬取某用户全部笔记（对应 main.py spider_user_all_note）',
  },
  args: {
    url: {
      type: 'string',
      description: '用户主页 URL',
      required: true,
    },
    cookies: { type: 'string' },
    save: { type: 'string', default: 'all' },
    out: { type: 'string', default: './datas' },
  },
  async run({ args }) {
    const cookiesStr = await resolveCookies(args.cookies)
    const userUrl = resolveUrlInput(args.url)
    const res = await getUserAllNotes(userUrl, cookiesStr)
    if (!res.success) {
      consola.error(`获取用户笔记失败: ${res.msg}`)
      process.exit(1)
    }
    const list = res.data ?? []
    consola.info(`用户作品数量: ${list.length}`)
    const noteUrls = list.map(
      (n: any) =>
        `https://www.xiaohongshu.com/explore/${n.note_id}?xsec_token=${n.xsec_token}`,
    )
    const excelName = userUrl.split('/').pop()?.split('?')[0] ?? 'user'
    await spiderSomeNote(
      noteUrls,
      cookiesStr,
      defaultBasePath(args.out),
      args.save as SaveChoice,
      excelName,
    )
  },
})

const searchCmd = defineCommand({
  meta: {
    name: 'search',
    description: '按关键词搜索笔记（对应 main.py spider_some_search_note）',
  },
  args: {
    query: { type: 'positional', required: true },
    num: { type: 'string', description: '需要数量', default: '20' },
    cookies: { type: 'string' },
    save: { type: 'string', default: 'all' },
    out: { type: 'string', default: './datas' },
    sort: {
      type: 'string',
      description: '0 综合 1 最新 2 最多点赞 3 最多评论 4 最多收藏',
      default: '0',
    },
    noteType: {
      type: 'string',
      description: '0 不限 1 视频 2 普通',
      default: '0',
    },
    noteTime: {
      type: 'string',
      description: '0 不限 1 一天 2 一周 3 半年',
      default: '0',
    },
  },
  async run({ args }) {
    const cookiesStr = await resolveCookies(args.cookies)
    const opts: SearchOptions = {
      sortTypeChoice: Number(args.sort) as any,
      noteType: Number(args.noteType) as any,
      noteTime: Number(args.noteTime) as any,
    }
    const res = await searchSomeNote(
      args.query,
      Number(args.num),
      cookiesStr,
      opts,
    )
    if (!res.success) {
      consola.error(`搜索失败: ${res.msg}`)
      process.exit(1)
    }
    const notes = (res.data ?? []).filter((x: any) => x.model_type === 'note')
    consola.info(`搜索 "${args.query}" 命中: ${notes.length}`)
    const noteUrls = notes.map(
      (n: any) =>
        `https://www.xiaohongshu.com/explore/${n.id}?xsec_token=${n.xsec_token}`,
    )
    await spiderSomeNote(
      noteUrls,
      cookiesStr,
      defaultBasePath(args.out),
      args.save as SaveChoice,
      args.query,
    )
  },
})

const main = defineCommand({
  meta: {
    name: 'spider-xhs',
    version: '0.1.1',
    description: 'Spider XHS (Bun/TS 版)',
  },
  subCommands: { note: noteCmd, user: userCmd, search: searchCmd },
})

process.argv = [
  ...process.argv.slice(0, 2),
  ...normalizeLegacyUrlArg(process.argv.slice(2)),
]

runMain(main)
