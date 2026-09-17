import { computed, h, ref, type VNodeChild } from 'vue'
import type { DataTableColumns, DataTableSortState } from 'naive-ui'
import { nextTableSortOrder, type TableSortOrder } from '@/utils/table-layout'

type SortableColumn = {
  key?: string | number
  title?: string | ((column: any) => VNodeChild)
  sorter?: unknown
  sortOrder?: TableSortOrder
}

export interface UseTableSortOptions<T> {
  /** 基础列定义（可含 sorter / 自定义 title） */
  columns: DataTableColumns<T>
  /** 初始排序列 key，不传表示默认不排序 */
  defaultKey?: string
  /** 初始排序方向 */
  defaultOrder?: Exclude<TableSortOrder, false>
}

const ORDER_LABEL: Record<string, string> = {
  ascend: '升序',
  descend: '降序'
}

/**
 * 单列排序模型：同一时刻只有一个 sortKey + sortOrder，点击其他可排序列即切换。
 * - 以 Naive UI 回传的 order 为唯一数据源，避免页面与组件各算一次
 * - 三态循环：降序 → 升序 → 取消
 * - 表头通过声明式渲染函数输出 aria-sort / aria-label（不直接操作 DOM）
 */
export function useTableSort<T>({ columns, defaultKey, defaultOrder = 'descend' }: UseTableSortOptions<T>) {
  const sortKey = ref<string | undefined>(defaultKey)
  const sortOrder = ref<TableSortOrder>(defaultKey ? defaultOrder : false)

  function handleSorterChange(state: DataTableSortState | DataTableSortState[] | null) {
    const next = Array.isArray(state) ? state[0] : state
    if (!next) {
      sortKey.value = undefined
      sortOrder.value = false
      return
    }
    const key = String(next.columnKey)
    if (sortKey.value !== key) {
      sortKey.value = key
      sortOrder.value = next.order === 'ascend' ? 'ascend' : 'descend'
      return
    }
    sortOrder.value = next.order ?? false
  }

  function renderSortTitle(column: SortableColumn): VNodeChild {
    const rawTitle = typeof column.title === 'function' ? column.title(column) : column.title
    const active = column.key != null && String(column.key) === sortKey.value && sortOrder.value !== false
    const ariaSort = active ? (sortOrder.value === 'ascend' ? 'ascending' : 'descending') : 'none'
    const label = active
      ? `${String(rawTitle ?? '')}，当前${ORDER_LABEL[String(sortOrder.value)]}排列`
      : String(rawTitle ?? '')
    return h(
      'span',
      {
        class: 'table-sort-header',
        'aria-sort': ariaSort,
        'aria-label': label,
        title: label
      },
      [rawTitle as VNodeChild]
    )
  }

  const decoratedColumns = () =>
    (columns as unknown as SortableColumn[]).map((column) => {
      if (!column.sorter) return column
      const isActive = column.key != null && String(column.key) === sortKey.value
      const decorated: Record<string, unknown> = { ...column }
      decorated.sortOrder = isActive ? sortOrder.value : false
      decorated.customNextSortOrder = nextTableSortOrder
      if (column.title != null) decorated.title = () => renderSortTitle(column)
      return decorated as unknown as SortableColumn
    })

  const sortedColumns = computed<DataTableColumns<T>>(
    () => decoratedColumns() as unknown as DataTableColumns<T>
  )

  return { sortKey, sortOrder, columns: sortedColumns, handleSorterChange }
}
