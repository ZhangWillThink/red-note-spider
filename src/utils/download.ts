import { dns } from 'bun'
import consola from 'consola'
/**
 * 媒体下载与目录输出。
 * 对应 Python: `xhs_utils/data_util.py::download_media / download_note / save_note_detail`
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { NoteInfo } from './data.ts'

import { normStr } from './data.ts'

/** 对应 `data_util.py::check_and_create_path` */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

/**
 * WSL 环境下系统 DNS 对 xhscdn 子域会卡住（只回 AAAA / 无响应）。
 * 这里预先用 `Bun.dns.lookup({family:4})` 拿到 IPv4，然后用 IP 直连 + Host 头发请求。
 * 对应 Python `main.py` 顶部 `socket.getaddrinfo = ipv4_only` 的补丁。
 */
const dnsCache = new Map<string, string>()
async function resolveIPv4(host: string): Promise<string> {
  const hit = dnsCache.get(host)
  if (hit) return hit
  const r = await dns.lookup(host, { family: 4 })
  const ip = Array.isArray(r) ? r[0]?.address : (r as any).address
  if (!ip) throw new Error(`DNS IPv4 解析失败: ${host}`)
  dnsCache.set(host, ip)
  return ip
}

/**
 * 简易并发限流器：限制同时 in-flight 的 Promise 数。
 * 相比 `p-limit` 无外部依赖，足够这里的下载场景使用。
 */
export function createLimiter(max: number) {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    if (active >= max || queue.length === 0) return
    active++
    queue.shift()!()
  }
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve))
    else active++
    try {
      return await fn()
    } finally {
      active--
      next()
    }
  }
}

/** 全局媒体下载并发上限（可通过 `XHS_DOWNLOAD_CONCURRENCY` 覆盖） */
const DEFAULT_CONCURRENCY = Number(process.env.XHS_DOWNLOAD_CONCURRENCY ?? 6)
const globalLimit = createLimiter(Math.max(1, DEFAULT_CONCURRENCY))

/**
 * 流式下载 + idle 超时：
 * - `connectTimeoutMs`：建立连接 + 收到响应头的硬超时
 * - `idleTimeoutMs`：连续 N 毫秒没新数据才算超时（避免大文件被整体硬超时打断）
 *
 * 视频文件几 MB 是常态，原先的整请求 30s 硬超时在慢链路下不够用。
 */
async function fetchToFileStreaming(
  ipUrl: string,
  hostHeader: string,
  filePath: string,
  connectTimeoutMs: number,
  idleTimeoutMs: number,
): Promise<void> {
  const connectCtrl = new AbortController()
  const connectTimer = setTimeout(
    () => connectCtrl.abort(new Error('连接超时')),
    connectTimeoutMs,
  )
  let resp: Response
  try {
    resp = await fetch(ipUrl, {
      signal: connectCtrl.signal,
      headers: {
        Host: hostHeader,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      },
    })
  } finally {
    clearTimeout(connectTimer)
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  if (!resp.body) throw new Error('响应无 body')

  await ensureDir(dirname(filePath))
  const file = Bun.file(filePath)
  const writer = file.writer()
  const reader = resp.body.getReader()
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let abortedByIdle = false
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      abortedByIdle = true
      reader.cancel(new Error('空闲超时')).catch(() => {})
    }, idleTimeoutMs)
  }
  try {
    resetIdle()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writer.write(value)
      resetIdle()
    }
    await writer.end()
  } catch (e) {
    await Promise.resolve(writer.end()).catch(() => {})
    if (abortedByIdle) throw new Error(`空闲超时 (>${idleTimeoutMs}ms 无数据)`)
    throw e
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
  }
}

/**
 * 带重试的媒体下载。对应 `download_media`，`type` 决定扩展名。
 *
 * - 图片：连接 15s + 空闲 15s
 * - 视频：连接 15s + 空闲 30s（视频文件大，主要靠 idle 超时判定卡住）
 *
 * 可通过 `XHS_DOWNLOAD_CONNECT_MS` / `XHS_DOWNLOAD_IDLE_MS` / `XHS_VIDEO_IDLE_MS` 覆盖。
 */
export async function downloadMedia(
  dirPath: string,
  name: string,
  url: string,
  type: 'image' | 'video',
  maxRetries = 3,
): Promise<boolean> {
  const ext = type === 'image' ? 'jpg' : 'mp4'
  const filePath = `${dirPath}/${name}.${ext}`
  const connectMs = Number(process.env.XHS_DOWNLOAD_CONNECT_MS ?? 15_000)
  const idleMs =
    type === 'video'
      ? Number(process.env.XHS_VIDEO_IDLE_MS ?? 30_000)
      : Number(process.env.XHS_DOWNLOAD_IDLE_MS ?? 15_000)
  return globalLimit(async () => {
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const parsed = new URL(url)
        const ip = await resolveIPv4(parsed.hostname)
        const ipUrl = `${parsed.protocol}//${ip}${parsed.pathname}${parsed.search}`
        await fetchToFileStreaming(
          ipUrl,
          parsed.hostname,
          filePath,
          connectMs,
          idleMs,
        )
        return true
      } catch (e) {
        lastErr = e
        consola.warn(
          `下载失败 (${attempt}/${maxRetries}) ${url}: ${(e as Error).message}`,
        )
        await new Promise((r) => setTimeout(r, attempt * 1500))
      }
    }
    consola.error(`下载最终失败 ${url}: ${(lastErr as Error)?.message}`)
    return false
  })
}

/** 对应 `data_util.py::save_note_detail` —— 写 detail.txt */
export async function saveNoteDetail(
  note: NoteInfo,
  path: string,
): Promise<void> {
  const lines = [
    `笔记id: ${note.note_id}`,
    `笔记url: ${note.note_url}`,
    `笔记类型: ${note.note_type}`,
    `用户id: ${note.user_id}`,
    `用户主页url: ${note.home_url}`,
    `昵称: ${note.nickname}`,
    `头像url: ${note.avatar}`,
    `标题: ${note.title}`,
    `描述: ${note.desc}`,
    `点赞数量: ${note.liked_count}`,
    `收藏数量: ${note.collected_count}`,
    `评论数量: ${note.comment_count}`,
    `分享数量: ${note.share_count}`,
    `视频封面url: ${note.video_cover}`,
    `视频地址url: ${note.video_addr}`,
    `图片地址url列表: ${JSON.stringify(note.image_list)}`,
    `标签: ${JSON.stringify(note.tags)}`,
    `上传时间: ${note.upload_time}`,
    `ip归属地: ${note.ip_location}`,
  ]
  await writeFile(`${path}/detail.txt`, lines.join('\n') + '\n', 'utf8')
}

export type SaveChoice =
  | 'media'
  | 'media-image'
  | 'media-video'
  | 'all'
  | 'excel'

/** 对应 `data_util.py::download_note` —— 写 info.json / detail.txt / 媒体 */
export async function downloadNote(
  note: NoteInfo,
  basePath: string,
  saveChoice: SaveChoice,
): Promise<string> {
  const title = (normStr(note.title).slice(0, 40) || '无标题').trim()
  const nickname = normStr(note.nickname).slice(0, 20)
  const savePath = `${basePath}/${nickname}_${note.user_id}/${title}_${note.note_id}`
  await ensureDir(savePath)
  await writeFile(`${savePath}/info.json`, JSON.stringify(note) + '\n', 'utf8')
  await saveNoteDetail(note, savePath)

  if (
    note.note_type === '图集' &&
    ['media', 'media-image', 'all'].includes(saveChoice)
  ) {
    await Promise.all(
      note.image_list.map((url, i) =>
        downloadMedia(savePath, `image_${i}`, url, 'image'),
      ),
    )
  } else if (
    note.note_type === '视频' &&
    ['media', 'media-video', 'all'].includes(saveChoice)
  ) {
    const tasks: Promise<boolean>[] = []
    if (note.video_cover)
      tasks.push(downloadMedia(savePath, 'cover', note.video_cover, 'image'))
    if (note.video_addr)
      tasks.push(downloadMedia(savePath, 'video', note.video_addr, 'video'))
    await Promise.all(tasks)
  }
  return savePath
}
