import type { DataTableColumn } from 'naive-ui'

const ellipsisTooltip = { tooltip: true as const }

/** 表格列宽设计 token — 长列仅 minWidth 以吸收剩余空间，短列固定 width，禁止平均铺满 */
export const TABLE_COL = {
  id: { width: 88, minWidth: 80, ellipsis: ellipsisTooltip },
  objectId: { minWidth: 140, ellipsis: ellipsisTooltip },
  uuid: { minWidth: 160, ellipsis: ellipsisTooltip },
  title: { minWidth: 200, ellipsis: ellipsisTooltip },
  name: { minWidth: 160, ellipsis: ellipsisTooltip },
  slug: { width: 120, minWidth: 108, ellipsis: ellipsisTooltip },
  summary: { minWidth: 180, ellipsis: ellipsisTooltip },
  description: { minWidth: 200, ellipsis: ellipsisTooltip },
  email: { minWidth: 180, ellipsis: ellipsisTooltip },
  phone: { width: 128, minWidth: 120 },
  author: { minWidth: 220, ellipsis: ellipsisTooltip },
  type: { width: 92, minWidth: 84 },
  category: { width: 100, minWidth: 92 },
  role: { width: 96, minWidth: 88 },
  status: { width: 92, minWidth: 84, align: 'center' as const },
  boolean: { width: 68, minWidth: 60, align: 'center' as const },
  number: { width: 72, minWidth: 64, align: 'right' as const },
  sort: { width: 68, minWidth: 60, align: 'right' as const },
  datetime: { width: 176, minWidth: 168 },
  date: { width: 116, minWidth: 108 },
  verify: { width: 100, minWidth: 92, align: 'center' as const },
  action1: { width: 84, minWidth: 76, fixed: 'right' as const, align: 'center' as const },
  action2: { width: 136, minWidth: 128, fixed: 'right' as const, align: 'center' as const },
  action3: { width: 188, minWidth: 172, fixed: 'right' as const, align: 'center' as const },
  action4: { width: 232, minWidth: 216, fixed: 'right' as const, align: 'center' as const },
  action5: { width: 300, minWidth: 280, fixed: 'right' as const, align: 'center' as const }
} as const

export type TableColPreset = keyof typeof TABLE_COL

type ColBase = Pick<DataTableColumn, 'width' | 'minWidth' | 'maxWidth' | 'align' | 'ellipsis' | 'fixed'>

/** 按 preset 生成列基础布局属性，可与 render 等业务属性合并 */
export function colLayout(preset: TableColPreset, overrides: Partial<ColBase> = {}): ColBase {
  return { ...TABLE_COL[preset], ...overrides }
}

/** 根据列 preset 估算横向滚动宽度（sum of minWidth + padding） */
export function tableScrollSum(presets: TableColPreset[], gutter = 40): number {
  const sum = presets.reduce((total, preset) => {
    const col = TABLE_COL[preset]
    const base = col.minWidth ?? col.width ?? 96
    return total + base
  }, 0)
  return sum + gutter
}

/** 列表页表格默认横向滚动阈值（列数粗算，优先用 tableScrollSum） */
export function tableScrollX(columnCount: number, base = 960): number {
  return Math.max(base, columnCount * 108)
}

/** 标准列表表格 props */
export function tableListProps(scrollX: number) {
  return {
    bordered: false as const,
    size: 'small' as const,
    scrollX,
    class: 'page-list-table admin-data-table'
  }
}

/** 弹窗 / 嵌套表格（无 flex-height） */
export function tableModalProps(scrollX: number) {
  return {
    ...tableListProps(scrollX),
    class: 'page-list-table admin-data-table admin-data-table--embedded'
  }
}

export type TableSortOrder = 'ascend' | 'descend' | false

/** 表格列两态排序：降序 ↔ 升序，首次点击默认降序 */
export function toggleTableSortOrder(order: TableSortOrder): 'ascend' | 'descend' {
  return order === 'descend' ? 'ascend' : 'descend'
}

/** 渲染纯文本单元格，空值显示占位符 */
export function cellText(value: unknown, placeholder = '—'): string {
  if (value == null || value === '') return placeholder
  return String(value)
}
