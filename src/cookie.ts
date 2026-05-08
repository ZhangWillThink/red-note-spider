#!/usr/bin/env bun
import consola from 'consola'
import { createInterface } from 'node:readline/promises'

import { parseCookies } from './utils/cookie.ts'

const COOKIE_FILE = 'cookies.txt'

async function main(): Promise<void> {
  consola.info('请粘贴从浏览器 Request Headers 复制的 Cookie 字段')

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

    await Bun.write(COOKIE_FILE, `${cookie}\n`)
    consola.success(`Cookie 已保存到 ${COOKIE_FILE}`)
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  consola.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
