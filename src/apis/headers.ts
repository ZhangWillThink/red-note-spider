import {
  generateXsXsCommon,
  generateXrayTraceId,
  generateXB3TraceId,
} from '../sign/index.ts'
import { parseCookies, serializeCookies } from '../utils/cookie.ts'

/** 复刻 `xhs_util.py::get_request_headers_template` */
function getRequestHeadersTemplate(): Record<string, string> {
  return {
    authority: 'edith.xiaohongshu.com',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'cache-control': 'no-cache',
    'content-type': 'application/json;charset=UTF-8',
    origin: 'https://www.xiaohongshu.com',
    pragma: 'no-cache',
    referer: 'https://www.xiaohongshu.com/',
    'sec-ch-ua':
      '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'x-b3-traceid': '',
    'x-mns': 'unload',
    'x-s': '',
    'x-s-common': '',
    'x-t': '',
    'x-xray-traceid': generateXrayTraceId(),
  }
}

export interface BuiltRequest {
  headers: Record<string, string>
  cookieHeader: string
  body?: string
}

/**
 * 复刻 `xhs_util.py::generate_request_params`
 * 返回可直接喂给 fetch 的 headers / body / Cookie 头。
 */
export function buildRequest(
  cookiesStr: string,
  api: string,
  data: object | '' = '',
  method: 'GET' | 'POST' = 'POST',
): BuiltRequest {
  const cookies = parseCookies(cookiesStr)
  const a1 = cookies.a1
  if (!a1) {
    throw new Error('cookies 中找不到 a1 字段，签名无法生成')
  }

  const payload = data === '' ? '' : data
  const { xs, xt, xs_common } = generateXsXsCommon(a1, api, payload, method)

  const headers = getRequestHeadersTemplate()
  headers['x-s'] = xs
  headers['x-t'] = String(xt)
  headers['x-s-common'] = xs_common
  headers['x-b3-traceid'] = generateXB3TraceId()
  headers['cookie'] = serializeCookies(cookies)

  const result: BuiltRequest = {
    headers,
    cookieHeader: headers['cookie']!,
  }
  if (data !== '') {
    // 复刻 Python: json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    result.body = JSON.stringify(data)
  }
  return result
}

/** 复刻 `xhs_util.py::splice_str` —— 简单拼 query，不做 URL encode */
export function spliceStr(
  api: string,
  params: Record<string, string | undefined>,
): string {
  const pairs: string[] = []
  for (const [k, v] of Object.entries(params)) {
    pairs.push(`${k}=${v ?? ''}`)
  }
  return `${api}?${pairs.join('&')}`
}
