/**
 * Excel 导出。
 * 对应 Python: `xhs_utils/data_util.py::save_to_xlsx`
 */
import ExcelJS from 'exceljs'

import { normText } from './data.ts'

export type SheetType = 'note' | 'user' | 'comment'

const HEADERS: Record<SheetType, string[]> = {
  note: [
    '笔记id',
    '笔记url',
    '笔记类型',
    '用户id',
    '用户主页url',
    '昵称',
    '头像url',
    '标题',
    '描述',
    '点赞数量',
    '收藏数量',
    '评论数量',
    '分享数量',
    '视频封面url',
    '视频地址url',
    '图片地址url列表',
    '标签',
    '上传时间',
    'ip归属地',
  ],
  user: [
    '用户id',
    '用户主页url',
    '用户名',
    '头像url',
    '小红书号',
    '性别',
    'ip地址',
    '介绍',
    '关注数量',
    '粉丝数量',
    '作品被赞和收藏数量',
    '标签',
  ],
  comment: [
    '笔记id',
    '笔记url',
    '评论id',
    '用户id',
    '用户主页url',
    '昵称',
    '头像url',
    '评论内容',
    '评论标签',
    '点赞数量',
    '上传时间',
    'ip归属地',
    '图片地址url列表',
  ],
}

/** 将一组对象按字段值顺序写入 xlsx。与 Python 版完全一致：按 dict 插入顺序取值 */
export async function saveToXlsx(
  rows: Record<string, unknown>[],
  filePath: string,
  type: SheetType = 'note',
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  ws.addRow(HEADERS[type])
  for (const row of rows) {
    const values = Object.values(row).map((v) => normText(String(v)))
    ws.addRow(values)
  }
  await wb.xlsx.writeFile(filePath)
}
