import type { DataTableColumn } from 'naive-ui'

const ellipsisTooltip = { tooltip: true as const }

/**
 * 管理端 DataTable 列宽 token
 * - 长文本列：仅 minWidth + maxWidth，吸收剩余空间，禁止平均拉伸
 * - 短字段 / 状态 / 数字 / 操作列：稳定 width（及 minWidth）
 */
export const TABLE_COL = {
  id: { width: 88, minWidth: 80, ellipsis: ellipsisTooltip },
  objectId: { width: 180, minWidth: 140, maxWidth: 320, ellipsis: ellipsisTooltip },
  uuid: { width: 200, minWidth: 160, maxWidth: 280, ellipsis: ellipsisTooltip },
  title: { width: 260, minWidth: 200, maxWidth: 360, ellipsis: ellipsisTooltip },
  name: { width: 190, minWidth: 160, maxWidth: 240, ellipsis: ellipsisTooltip },
  slug: { width: 120, minWidth: 108, maxWidth: 160, ellipsis: ellipsisTooltip },
  summary: { width: 220, minWidth: 180, maxWidth: 320, ellipsis: ellipsisTooltip },
  description: { width: 260, minWidth: 200, maxWidth: 360, ellipsis: ellipsisTooltip },
  email: { width: 220, minWidth: 180, maxWidth: 300, ellipsis: ellipsisTooltip },
  phone: { width: 128, minWidth: 120 },
  author: { width: 250, minWidth: 220, maxWidth: 320, ellipsis: ellipsisTooltip },
  type: { width: 92, minWidth: 84 },
  category: { width: 100, minWidth: 92 },
  role: { width: 96, minWidth: 88 },
  /** 通用状态列（启用/禁用等） */
  status: { width: 92, minWidth: 84, align: 'center' as const },
  /** 社区用户等业务：账号 / 审核状态（字段仍为 status） */
  accountStatus: { width: 100, minWidth: 92, align: 'center' as const },
  boolean: { width: 68, minWidth: 60, align: 'center' as const },
  number: { width: 72, minWidth: 64, align: 'right' as const },
  sort: { width: 68, minWidth: 60, align: 'right' as const },
  /** 比率 / 进度可视化列（如磁盘使用率进度条），比 number 宽且不居中 */
  progress: { width: 140, minWidth: 120 },
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

/** scrollX 计算常量：纵向滚动条占位（gutter）与固定类型列默认宽度，全部显式声明 */
const SCROLL_GUTTER = 48
const SELECTION_WIDTH = 40
const EXPAND_WIDTH = 40
const FALLBACK_COL_WIDTH = 96

function readColSpan(value?: number | string): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  // 百分比宽度随容器伸缩，不计入固定 scrollX（避免把 "20%" 误当 20px）
  if (value.trim().endsWith('%')) return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type ScrollColLike = {
  width?: number | string
  minWidth?: number | string
  maxWidth?: number | string
  type?: string
  children?: ScrollColLike[]
}

/** 累加单列（或分组列之子列）的有效像素宽度；固定类型列（selection/expand）按显式宽度或默认值计入，避免低估 scrollX */
function sumColumnSpan(column: ScrollColLike): number {
  if (column.children?.length) {
    // 分组表头：宽度为子列之和，不能跳过（否则低估 scrollX）
    return column.children.reduce((acc, child) => acc + sumColumnSpan(child), 0)
  }
  if (column.type === 'selection') return readColSpan(column.width) || SELECTION_WIDTH
  if (column.type === 'expand') return readColSpan(column.width) || EXPAND_WIDTH
  // fixed 布局下以 width 为准，缺失时回退 minWidth，再回退默认
  return readColSpan(column.width) || readColSpan(column.minWidth) || FALLBACK_COL_WIDTH
}

/** 根据列定义计算 scrollX（禁止 columnCount * 常量）；gutter 为纵向滚动条占位，显式计入 */
export function tableScrollFromColumns(columns: readonly ScrollColLike[], gutter = SCROLL_GUTTER): number {
  return columns.reduce((sum, column) => sum + sumColumnSpan(column), gutter)
}

/** 根据列 preset 序列计算 scrollX */
export function tableScrollSum(presets: TableColPreset[], gutter = 48): number {
  const sum = presets.reduce((total, preset) => {
    const col: ColBase = TABLE_COL[preset]
    const base = readColSpan(col.width) || readColSpan(col.minWidth) || 96
    return total + base
  }, 0)
  return sum + gutter
}

/** 标准列表表格 props（不含 flex-height） */
export function tableListProps(scrollX: number) {
  return {
    bordered: false as const,
    size: 'small' as const,
    scrollX,
    class: 'page-list-table admin-data-table'
  }
}

/** 占满 page-list-body 剩余高度的列表表格 */
export function tableListFlexProps(scrollX: number) {
  return {
    ...tableListProps(scrollX),
    'flex-height': true as const
  }
}

/** 弹窗 / 嵌套表格（无 flex-height） */
export function tableModalProps(scrollX: number) {
  return {
    ...tableListProps(scrollX),
    class: 'page-list-table admin-data-table admin-data-table--embedded'
  }
}

/** 列表页默认分页（前端分页时使用） */
export const defaultListPagination = {
  pageSize: 10,
  showSizePicker: false,
  pageSlot: 7
} as const

export type TableSortOrder = 'ascend' | 'descend' | false

/** 表格列三态排序：降序 → 升序 → 取消（恢复数据原始顺序）→ 降序 */
export function nextTableSortOrder(order: TableSortOrder): TableSortOrder {
  if (order === 'descend') return 'ascend'
  if (order === 'ascend') return false
  return 'descend'
}

/** 日期时间展示：ISO/时间戳 → YYYY-MM-DD HH:mm（本地时区），非法值回落占位符 */
export function formatDateTime(value?: string | number | null, placeholder = '—'): string {
  if (value == null || value === '') return placeholder
  const time = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(time)) return placeholder
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return placeholder
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toTime(value: unknown): number {
  if (value == null || value === '') return Number.NaN
  if (typeof value === 'number') return value
  return Date.parse(String(value))
}

function compareWithEmptyAsMin(left: number, right: number, leftEmpty: boolean, rightEmpty: boolean): number {
  if (leftEmpty && rightEmpty) return 0
  if (leftEmpty) return -1
  if (rightEmpty) return 1
  return left - right
}

/** 日期/时间列比较：按时间戳比较（禁止字符串字典序）；空值视为最小，升序在前、降序在后 */
export function compareDateTime(a?: string | number | null, b?: string | number | null): number {
  const left = toTime(a)
  const right = toTime(b)
  return compareWithEmptyAsMin(left, right, Number.isNaN(left), Number.isNaN(right))
}

/** 数值列比较：统一按 Number 处理（避免 "10" < "9" 的字典序问题）；空值视为最小 */
export function compareNumber(a?: unknown, b?: unknown): number {
  const toNum = (value: unknown) => {
    if (value == null || value === '') return Number.NaN
    const num = Number(value)
    return Number.isFinite(num) ? num : Number.NaN
  }
  const left = toNum(a)
  const right = toNum(b)
  return compareWithEmptyAsMin(left, right, Number.isNaN(left), Number.isNaN(right))
}

/** 渲染纯文本单元格，空值显示占位符 */
export function cellText(value: unknown, placeholder = '—'): string {
  if (value == null || value === '') return placeholder
  return String(value)
}
