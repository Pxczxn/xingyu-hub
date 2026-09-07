import type { DataTableColumn } from 'naive-ui'

/** 表格列宽设计 token — 按字段类型分配，禁止平均铺满 */
export const TABLE_COL = {
  id: { width: 108, minWidth: 96, ellipsis: { tooltip: true } },
  objectId: { width: 148, minWidth: 128, ellipsis: { tooltip: true } },
  uuid: { width: 168, minWidth: 148, ellipsis: { tooltip: true } },
  title: { width: 260, minWidth: 200, ellipsis: { tooltip: true } },
  name: { width: 200, minWidth: 160, ellipsis: { tooltip: true } },
  slug: { width: 140, minWidth: 120, ellipsis: { tooltip: true } },
  summary: { width: 220, minWidth: 180, ellipsis: { tooltip: true } },
  description: { width: 240, minWidth: 200, ellipsis: { tooltip: true } },
  email: { width: 220, minWidth: 180, ellipsis: { tooltip: true } },
  phone: { width: 132, minWidth: 120 },
  author: { width: 260, minWidth: 220, ellipsis: { tooltip: true } },
  type: { width: 96, minWidth: 88 },
  category: { width: 108, minWidth: 96 },
  role: { width: 100, minWidth: 88 },
  status: { width: 96, minWidth: 88, align: 'center' as const },
  boolean: { width: 72, minWidth: 64, align: 'center' as const },
  number: { width: 72, minWidth: 64, align: 'right' as const },
  sort: { width: 72, minWidth: 64, align: 'right' as const },
  datetime: { width: 172, minWidth: 168 },
  date: { width: 120, minWidth: 110 },
  verify: { width: 168, minWidth: 150 },
  action1: { width: 88, minWidth: 80, fixed: 'right' as const, align: 'center' as const },
  action2: { width: 148, minWidth: 136, fixed: 'right' as const, align: 'center' as const },
  action3: { width: 196, minWidth: 176, fixed: 'right' as const, align: 'center' as const },
  action4: { width: 248, minWidth: 228, fixed: 'right' as const, align: 'center' as const }
} as const

export type TableColPreset = keyof typeof TABLE_COL

type ColBase = Pick<DataTableColumn, 'width' | 'minWidth' | 'maxWidth' | 'align' | 'ellipsis' | 'fixed'>

/** 按 preset 生成列基础布局属性，可与 render 等业务属性合并 */
export function colLayout(preset: TableColPreset, overrides: Partial<ColBase> = {}): ColBase {
  return { ...TABLE_COL[preset], ...overrides }
}

/** 列表页表格默认横向滚动阈值（可按列数微调） */
export function tableScrollX(columnCount: number, base = 960): number {
  return Math.max(base, columnCount * 120)
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

/** 渲染纯文本单元格，空值显示占位符 */
export function cellText(value: unknown, placeholder = '—'): string {
  if (value == null || value === '') return placeholder
  return String(value)
}
