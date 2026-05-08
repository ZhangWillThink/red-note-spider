/** 复刻 `xhs_utils/cookie_util.py::trans_cookies` */
export function parseCookies(cookiesStr: string): Record<string, string> {
  const sep = cookiesStr.includes('; ') ? '; ' : ';'
  const result: Record<string, string> = {}
  for (const pair of cookiesStr.split(sep)) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1)
    if (key) result[key] = value
  }
  return result
}

/** 把 cookie map 序列化回 `k=v; k2=v2` */
export function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}
