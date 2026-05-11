/**
 * 简易并发限流器：限制同时 in-flight 的 Promise 数。
 */

export function createLimiter(max: number) {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    if (active >= max || queue.length === 0) return
    active++
    queue.shift()!()
  }
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve))
    else active++
    try {
      return await fn()
    } finally {
      active--
      next()
    }
  }
}
