#!/usr/bin/env bun
import consola from 'consola'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'

import { parseCookies } from './utils/cookie.ts'
import { cookieFilePath } from './utils/xhs-paths.ts'

async function main(): Promise<void> {
  const target = cookieFilePath()
  consola.info(
    `请将浏览器 Request Headers 中的 Cookie 粘贴在下方（将写入 ${target}）`,
  )

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const input = await rl.question('Cookie: ')
    const cookie = input.trim()

    if (!cookie) {
      throw new Error('Cookie 不能为空')
    }

    if (!parseCookies(cookie).a1) {
      throw new Error('Cookie 中找不到 a1 字段，签名无法生成')
    }

    if (!parseCookies(cookie).web_session?.trim()) {
      consola.warn(
        '未检测到 web_session。若后续提示「无登录信息」，请在 Network 中选中发往 edith.xiaohongshu.com 的请求，再复制其 Request Headers 里的完整 Cookie。',
      )
    }

    await mkdir(dirname(target), { recursive: true })
    await Bun.write(target, `${cookie}\n`)
    consola.success(`Cookie 已保存到 ${target}`)
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  consola.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
