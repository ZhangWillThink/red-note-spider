import consola from 'consola'

import { generateXB3TraceId } from '../sign/index.ts'
import { buildRequest, spliceStr } from './headers.ts'

const BASE_URL = 'https://edith.xiaohongshu.com'

function envNonNegInt(name: string, defaultVal: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return defaultVal
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return defaultVal
  return Math.floor(n)
}

/** 每次 Edith API 调用结束后暂停的毫秒数（0 表示不限制，默认 0） */
function getRequestDelayMs(): number {
  return envNonNegInt('XHS_REQUEST_DELAY_MS', 0)
}

/**
 * 失败后的最多重试次数（不含首次请求）。
 * 例如 2 表示最多共 3 次请求。
 */
function getApiRetryCount(): number {
  return envNonNegInt('XHS_API_MAX_RETRIES', 2)
}

function getApiRetryBaseMs(): number {
  return envNonNegInt('XHS_API_RETRY_BASE_MS', 1500)
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms))
}

async function politeDelay(): Promise<void> {
  const ms = getRequestDelayMs()
  if (ms > 0) await sleep(ms)
}

function formatBodyMsg(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

/** 网络错误或部分 HTTP 状态时可退避重试 */
function isRetryableHttpStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 460 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
}

export interface ApiResult<T = unknown> {
  success: boolean
  msg: string
  data: T | null
  /** 最后一次 HTTP 状态码（拿到响应时才有） */
  httpStatus?: number
}

async function call<T = unknown>(
  method: 'GET' | 'POST',
  api: string,
  cookiesStr: string,
  body: object | '' = '',
): Promise<ApiResult<T>> {
  const req = buildRequest(cookiesStr, api, body, method)
  const retries = getApiRetryCount()
  const maxAttempts = retries + 1
  const baseMs = getApiRetryBaseMs()

  let last: ApiResult<T> = { success: false, msg: '', data: null }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(BASE_URL + api, {
        method,
        headers: req.headers,
        body: req.body,
      })
      const status = resp.status
      const text = await resp.text()

      let parsed: unknown = null
      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = null
        }
      }

      const j = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null

      if (!resp.ok) {
        const snippet =
          text.length > 280 ? `${text.slice(0, 280)}…` : text
        const fromBody = j ? formatBodyMsg(j.msg) : ''
        last = {
          success: false,
          msg: fromBody || (snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`),
          data: (parsed ?? null) as T | null,
          httpStatus: status,
        }
        if (isRetryableHttpStatus(status) && attempt < maxAttempts - 1) {
          consola.warn(
            `[api] ${method} ${api} HTTP ${status}，${baseMs * (attempt + 1)}ms 后重试 (${attempt + 1}/${retries})`,
          )
          await sleep(baseMs * (attempt + 1))
          continue
        }
        await politeDelay()
        return last
      }

      last = {
        success: Boolean(j?.success),
        msg: j ? formatBodyMsg(j.msg) : '',
        data: parsed as T,
        httpStatus: status,
      }
      await politeDelay()
      return last
    } catch (e) {
      last = {
        success: false,
        msg: (e as Error).message,
        data: null,
      }
      if (attempt < maxAttempts - 1) {
        consola.warn(
          `[api] ${method} ${api} 请求异常：${last.msg}，${baseMs * (attempt + 1)}ms 后重试 (${attempt + 1}/${retries})`,
        )
        await sleep(baseMs * (attempt + 1))
        continue
      }
      await politeDelay()
      return last
    }
  }

  await politeDelay()
  return last
}

/** 复刻 `xhs_pc_apis.py::get_note_info` */
export async function getNoteInfo(
  url: string,
  cookiesStr: string,
): Promise<ApiResult> {
  const u = new URL(url)
  const noteId = u.pathname.split('/').filter(Boolean).pop() ?? ''
  const params = Object.fromEntries(u.searchParams.entries())
  const api = '/api/sns/web/v1/feed'
  const data = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: '1' },
    xsec_source: params.xsec_source ?? 'pc_search',
    xsec_token: params.xsec_token ?? '',
  }
  return call('POST', api, cookiesStr, data)
}

/** 复刻 `xhs_pc_apis.py::get_user_note_info` */
export async function getUserNoteInfo(
  userId: string,
  cursor: string,
  cookiesStr: string,
  xsecToken = '',
  xsecSource = '',
): Promise<ApiResult> {
  const api = spliceStr('/api/sns/web/v1/user_posted', {
    num: '30',
    cursor,
    user_id: userId,
    image_formats: 'jpg,webp,avif',
    xsec_token: xsecToken,
    xsec_source: xsecSource,
  })
  return call('GET', api, cookiesStr, '')
}

/** 复刻 `xhs_pc_apis.py::get_user_all_notes` —— 分页聚合 */
export async function getUserAllNotes(
  userUrl: string,
  cookiesStr: string,
): Promise<ApiResult<unknown[]>> {
  const notes: unknown[] = []
  try {
    const u = new URL(userUrl)
    const userId = u.pathname.split('/').filter(Boolean).pop() ?? ''
    const xsecToken = u.searchParams.get('xsec_token') ?? ''
    const xsecSource = u.searchParams.get('xsec_source') ?? 'pc_search'
    let cursor = ''
    while (true) {
      const res = await getUserNoteInfo(
        userId,
        cursor,
        cookiesStr,
        xsecToken,
        xsecSource,
      )
      if (!res.success) {
        const hint = res.httpStatus != null ? ` (HTTP ${res.httpStatus})` : ''
        throw new Error(`${res.msg}${hint}`)
      }
      const batch = (res.data as { data?: { notes?: unknown[] } } | null)?.data
        ?.notes ?? []
      notes.push(...batch)
      const page = (res.data as { data?: { cursor?: unknown; has_more?: boolean } } | null)
        ?.data
      if (page?.cursor === undefined) break
      cursor = String(page.cursor)
      if (batch.length === 0 || !page.has_more) break
    }
    return { success: true, msg: '', data: notes }
  } catch (e) {
    return { success: false, msg: (e as Error).message, data: notes }
  }
}

export interface SearchOptions {
  sortTypeChoice?: 0 | 1 | 2 | 3 | 4
  noteType?: 0 | 1 | 2
  noteTime?: 0 | 1 | 2 | 3
  noteRange?: 0 | 1 | 2 | 3
  posDistance?: 0 | 1 | 2
  geo?: string
}

/** 复刻 `xhs_pc_apis.py::search_note`（单页） */
export async function searchNote(
  query: string,
  cookiesStr: string,
  page = 1,
  opts: SearchOptions = {},
): Promise<ApiResult> {
  const sortMap = [
    'general',
    'time_descending',
    'popularity_descending',
    'comment_descending',
    'collect_descending',
  ] as const
  const noteTypeMap = ['不限', '视频笔记', '普通笔记']
  const noteTimeMap = ['不限', '一天内', '一周内', '半年内']
  const noteRangeMap = ['不限', '已看过', '未看过', '已关注']
  const posDistanceMap = ['不限', '同城', '附近']

  const sortType = sortMap[opts.sortTypeChoice ?? 0]
  const filterNoteType = noteTypeMap[opts.noteType ?? 0]!
  const filterNoteTime = noteTimeMap[opts.noteTime ?? 0]!
  const filterNoteRange = noteRangeMap[opts.noteRange ?? 0]!
  const filterPosDistance = posDistanceMap[opts.posDistance ?? 0]!
  const geo = opts.geo ? JSON.stringify(opts.geo) : ''

  const api = '/api/sns/web/v1/search/notes'
  const data = {
    keyword: query,
    page,
    page_size: 20,
    search_id: generateXB3TraceId(21),
    sort: 'general',
    note_type: 0,
    ext_flags: [],
    filters: [
      { tags: [sortType], type: 'sort_type' },
      { tags: [filterNoteType], type: 'filter_note_type' },
      { tags: [filterNoteTime], type: 'filter_note_time' },
      { tags: [filterNoteRange], type: 'filter_note_range' },
      { tags: [filterPosDistance], type: 'filter_pos_distance' },
    ],
    geo,
    image_formats: ['jpg', 'webp', 'avif'],
  }
  return call('POST', api, cookiesStr, data)
}

/** 复刻 `xhs_pc_apis.py::search_some_note` —— 分页聚合 */
export async function searchSomeNote(
  query: string,
  requireNum: number,
  cookiesStr: string,
  opts: SearchOptions = {},
  maxPages = 50,
): Promise<ApiResult<unknown[]>> {
  const notes: unknown[] = []
  try {
    let page = 1
    while (page <= maxPages) {
      const res = await searchNote(query, cookiesStr, page, opts)
      if (!res.success) {
        const hint = res.httpStatus != null ? ` (HTTP ${res.httpStatus})` : ''
        throw new Error(`${res.msg}${hint}`)
      }
      const items = (res.data as { data?: { items?: unknown[]; has_more?: boolean } } | null)
        ?.data?.items
      if (!items) break
      notes.push(...items)
      page += 1
      const hasMore = (res.data as { data?: { has_more?: boolean } } | null)?.data
        ?.has_more
      if (notes.length >= requireNum || !hasMore) break
    }
    const sliced =
      notes.length > requireNum ? notes.slice(0, requireNum) : notes
    return { success: true, msg: '', data: sliced }
  } catch (e) {
    return { success: false, msg: (e as Error).message, data: notes }
  }
}
