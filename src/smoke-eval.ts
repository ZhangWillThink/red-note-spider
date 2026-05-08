// 方案 B：直接在 Bun 主线程全局加载 JS，看看能否注册 mnsv2
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const MAIN_JS = resolve(REPO_ROOT, 'static/xhs_main_260411.js')

// 提前占位，让脚本里的 `window = ...` 重新赋值不会崩
;(globalThis as any).window = globalThis
;(globalThis as any).self = globalThis
;(globalThis as any).require = createRequire(MAIN_JS)
;(globalThis as any).module = { exports: {} }
;(globalThis as any).exports = (globalThis as any).module.exports

const code = readFileSync(MAIN_JS, 'utf-8')

try {
  // 用 Function 构造，以便在全局作用域执行
  const runner = new Function('require', 'module', 'exports', code)
  const mod: any = { exports: {} }
  runner((globalThis as any).require, mod, mod.exports)
  console.log('脚本加载完毕')
  console.log('exports keys:', Object.keys(mod.exports))
  console.log('mnsv2 类型:', typeof (globalThis as any).mnsv2)
  console.log('window.mnsv2 类型:', typeof (globalThis as any).window?.mnsv2)
  console.log(
    'get_request_headers_params 类型:',
    typeof (globalThis as any).get_request_headers_params,
  )
} catch (e) {
  console.error('加载失败:', e)
}
