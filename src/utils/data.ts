/**
 * 数据整形与保存工具。
 * 对应 Python: `xhs_utils/data_util.py`
 */

/** 对应 `data_util.py::norm_str`：清理文件名非法字符 */
export function normStr(s: string): string {
  return s.replace(/[\\/:*?"<>| ]+/g, '').replace(/[\r\n]/g, '')
}

/** 对应 `data_util.py::norm_text`：清理 Excel 非法控制字符 */
export function normText(text: string): string {
  // openpyxl 的 ILLEGAL_CHARACTERS_RE 对应的等价正则
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/** 对应 `data_util.py::timestamp_to_str`：毫秒时间戳 → 本地时间字符串 */
export function timestampToStr(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export interface NoteInfo {
  note_id: string
  note_url: string
  note_type: '图集' | '视频'
  user_id: string
  home_url: string
  nickname: string
  avatar: string
  title: string
  desc: string
  liked_count: string | number
  collected_count: string | number
  comment_count: string | number
  share_count: string | number
  video_cover: string | null
  video_addr: string | null
  image_list: string[]
  tags: string[]
  upload_time: string
  ip_location: string
}

/** 对应 `data_util.py::handle_note_info` */
export function handleNoteInfo(data: any): NoteInfo {
  const noteId = data.id
  const noteUrl = data.url
  const rawType = data.note_card?.type
  const noteType: '图集' | '视频' = rawType === 'normal' ? '图集' : '视频'

  const user = data.note_card?.user ?? {}
  const userId = user.user_id ?? ''
  const homeUrl = `https://www.xiaohongshu.com/user/profile/${userId}`

  let title: string = data.note_card?.title ?? ''
  if (!title.trim()) title = '无标题'
  const desc: string = data.note_card?.desc ?? ''

  const interact = data.note_card?.interact_info ?? {}

  const imageListTemp: any[] = data.note_card?.image_list ?? []
  const imageList: string[] = []
  for (const image of imageListTemp) {
    const url = image?.info_list?.[1]?.url
    if (url) imageList.push(url)
  }

  let videoCover: string | null = null
  let videoAddr: string | null = null
  if (noteType === '视频') {
    videoCover = imageList[0] ?? null
    const videoInfo = data.note_card?.video ?? {}
    const streams = videoInfo?.media?.stream?.h264 ?? []
    if (streams.length > 0) {
      videoAddr = streams[0].master_url ?? streams[0].url ?? null
    }
    if (!videoAddr && videoInfo.consumer) {
      const originKey = videoInfo.consumer.origin_video_key
      if (originKey) videoAddr = `https://sns-video-bd.xhscdn.com/${originKey}`
    }
  }

  const tagsTemp: any[] = data.note_card?.tag_list ?? []
  const tags: string[] = []
  for (const t of tagsTemp) {
    if (t?.name) tags.push(t.name)
  }

  const uploadTime = timestampToStr(data.note_card?.time ?? 0)
  const ipLocation = data.note_card?.ip_location ?? '未知'

  return {
    note_id: noteId,
    note_url: noteUrl,
    note_type: noteType,
    user_id: userId,
    home_url: homeUrl,
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
    title,
    desc,
    liked_count: interact.liked_count ?? 0,
    collected_count: interact.collected_count ?? 0,
    comment_count: interact.comment_count ?? 0,
    share_count: interact.share_count ?? 0,
    video_cover: videoCover,
    video_addr: videoAddr,
    image_list: imageList,
    tags,
    upload_time: uploadTime,
    ip_location: ipLocation,
  }
}
