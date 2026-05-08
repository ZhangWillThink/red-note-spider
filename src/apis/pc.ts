import { generateXB3TraceId } from '../sign/index.ts'
import { buildRequest, spliceStr } from './headers.ts'

const BASE_URL = 'https://edith.xiaohongshu.com'

export interface ApiResult<T = any> {
  success: boolean
  msg: string
  data: T | null
}

async function call<T = any>(
  method: 'GET' | 'POST',
  api: string,
  cookiesStr: string,
  body: object | '' = '',
): Promise<ApiResult<T>> {
  try {
    const req = buildRequest(cookiesStr, api, body, method)
    const resp = await fetch(BASE_URL + api, {
      method,
      headers: req.headers,
      body: req.body,
    })
    const json = (await resp.json()) as any
    return {
      success: Boolean(json?.success),
      msg: json?.msg ?? '',
      data: json,
    }
  } catch (e) {
    return { success: false, msg: (e as Error).message, data: null }
  }
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
): Promise<ApiResult<any[]>> {
  const notes: any[] = []
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
      if (!res.success) throw new Error(res.msg)
      const batch = res.data?.data?.notes ?? []
      notes.push(...batch)
      if (res.data?.data?.cursor === undefined) break
      cursor = String(res.data.data.cursor)
      if (batch.length === 0 || !res.data.data.has_more) break
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
): Promise<ApiResult<any[]>> {
  const notes: any[] = []
  try {
    let page = 1
    while (page <= maxPages) {
      const res = await searchNote(query, cookiesStr, page, opts)
      if (!res.success) throw new Error(res.msg)
      const items = res.data?.data?.items
      if (!items) break
      notes.push(...items)
      page += 1
      if (notes.length >= requireNum || !res.data?.data?.has_more) break
    }
    const sliced =
      notes.length > requireNum ? notes.slice(0, requireNum) : notes
    return { success: true, msg: '', data: sliced }
  } catch (e) {
    return { success: false, msg: (e as Error).message, data: notes }
  }
}
