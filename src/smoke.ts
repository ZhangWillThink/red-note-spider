// 签名模块冒烟测试：确保 JS 能在 Bun + vm 环境里产出 xs / xt / xs_common
import consola from 'consola'

import {
  generateXB3TraceId,
  generateXrayTraceId,
  generateXsXsCommon,
} from './sign/index.ts'

const a1 = '1908d1a0b6eb13b5egsm8ggm97q17yfuv92n4l0g850000266761'
const api = '/api/sns/web/v1/feed'
const data = {
  source_note_id: '68f88251000000000301d972',
  image_formats: ['jpg', 'webp', 'avif'],
  extra: { need_body_topic: '1' },
  xsec_source: 'pc_feed',
  xsec_token: 'ABfuVL1abrca5AtSMfNR0pWGBkZh387i3pykPOCHh4QbA=',
}

consola.log('=== X-S 签名冒烟测试 ===')
const sig = generateXsXsCommon(a1, api, data, 'POST')
consola.log('xs:', sig.xs)
consola.log('xs 长度:', sig.xs?.length)
consola.log('xt:', sig.xt)
consola.log('xs_common 长度:', sig.xs_common?.length)
consola.log('xray traceId:', generateXrayTraceId())
consola.log('x-b3-traceid:', generateXB3TraceId())
