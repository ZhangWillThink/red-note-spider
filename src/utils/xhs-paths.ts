import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * 本机状态根目录（Cookie 等，不入仓库）。
 * - 显式：XHS_STATE_DIR
 * - Linux/macOS：$XDG_STATE_HOME/spider-xhs-bun（默认 ~/.local/state/spider-xhs-bun）
 * - Windows：%APPDATA%/spider-xhs-bun
 */
export function stateDir(): string {
  if (process.env.XHS_STATE_DIR?.trim()) {
    return resolve(process.env.XHS_STATE_DIR.trim())
  }
  return join(stateBaseDir(), 'spider-xhs-bun')
}

function stateBaseDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  }
  return (
    process.env.XDG_STATE_HOME?.trim() ||
    join(homedir(), '.local', 'state')
  )
}

/** Cookie 文件路径：XHS_COOKIES_FILE 优先，否则为 stateDir()/cookies.txt */
export function cookieFilePath(): string {
  if (process.env.XHS_COOKIES_FILE?.trim()) {
    return resolve(process.env.XHS_COOKIES_FILE.trim())
  }
  return join(stateDir(), 'cookies.txt')
}

/**
 * 爬取结果根目录（media_datas / excel_datas 的父目录）。
 * 优先级：CLI --out > XHS_DATA_DIR > ./datas（相对当前工作目录）
 */
export function resolveOutputRoot(cliOut?: string): string {
  const o = cliOut?.trim()
  if (o) return resolve(o)
  const env = process.env.XHS_DATA_DIR?.trim()
  if (env) return resolve(env)
  return resolve('./datas')
}
