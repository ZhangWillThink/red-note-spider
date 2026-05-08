import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 在 Bun 主进程全局作用域加载小红书签名 JS 脚本。
 *
 * 为什么不用 vm？
 * 混淆代码期望 window / globalThis 上能自由注册 mnsv2 等全局函数。
 * vm context 里 `window = globalThis` 后某些动态挂载会失败。
 * 直接用 `new Function(...)` 在主进程执行能保证 mnsv2 正确注册。
 * 签名计算是纯函数、一次性加载 + 多次调用，不会在主进程留副作用问题。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const MAIN_JS = resolve(REPO_ROOT, 'static/xhs_main_260411.js')
const XRAY_JS = resolve(REPO_ROOT, 'static/xhs_xray.js')

export interface XsHeaders {
  xs: string
  xt: string | number
  xs_common: string
}

type SignFn = (
  api: string,
  data: string | object,
  a1: string,
  method: string,
) => XsHeaders
type TraceFn = () => string

// 预置 window / self 为 globalThis 本身，脚本会自行重新赋值
;(globalThis as any).window ??= globalThis
;(globalThis as any).self ??= globalThis

function loadScript(filePath: string): any {
  const code = readFileSync(filePath, 'utf-8')
  const req = createRequire(filePath)
  const module = { exports: {} as any }
  // 脚本内有大量开发者自测 console.log（随机数、报错 trace 等），静音之。
  const origLog = console.log
  const origErr = console.error
  const origWarn = console.warn
  console.log = () => {}
  console.error = () => {}
  console.warn = () => {}
  try {
    const runner = new Function('require', 'module', 'exports', code)
    runner(req, module, module.exports)
  } finally {
    console.log = origLog
    console.error = origErr
    console.warn = origWarn
  }
  return module.exports
}

const signExports = loadScript(MAIN_JS) as {
  get_request_headers_params: SignFn
}
const xrayExports = loadScript(XRAY_JS) as Partial<{
  traceId: TraceFn
}>

/** 静默执行回调中的 console 输出（签名脚本内部有 try/catch 但仍会 console.error） */
function silent<T>(fn: () => T): T {
  const origLog = console.log
  const origErr = console.error
  const origWarn = console.warn
  console.log = () => {}
  console.error = () => {}
  console.warn = () => {}
  try {
    return fn()
  } finally {
    console.log = origLog
    console.error = origErr
    console.warn = origWarn
  }
}

/** 复刻 `xhs_util.py::generate_xs_xs_common` */
export function generateXsXsCommon(
  a1: string,
  api: string,
  data: string | object = '',
  method: 'GET' | 'POST' = 'POST',
): XsHeaders {
  return silent(() =>
    signExports.get_request_headers_params(api, data, a1, method),
  )
}

/** 复刻 `xhs_util.py::generate_xray_traceid` */
export function generateXrayTraceId(): string {
  const fn = xrayExports.traceId ?? (globalThis as any).traceId
  if (typeof fn !== 'function') {
    throw new Error('xhs_xray.js 中未找到 traceId 函数')
  }
  return silent(() => fn())
}

/** 复刻 `xhs_util.py::generate_x_b3_traceid` */
export function generateXB3TraceId(len = 16): string {
  const chars = 'abcdef0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * 16)]
  }
  return out
}
