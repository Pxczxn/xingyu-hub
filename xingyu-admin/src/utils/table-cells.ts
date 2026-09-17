import { h, type VNodeChild } from 'vue'
import { NButton, NEllipsis, NIcon, NTag } from 'naive-ui'
import { cellText, formatDateTime } from '@/utils/table-layout'
import type { ButtonProps, TagProps } from 'naive-ui'
import { CreateOutline, TrashOutline } from '@vicons/ionicons5'
import TableLink from '@/components/community/TableLink.vue'
import { resolveStatusLabel } from '@/utils/community-display'

/** 带 tooltip 的单行省略文本（列未开启 ellipsis 时的补充） */
export function renderEllipsisText(value: unknown, placeholder = '—'): VNodeChild {
  const text = cellText(value, placeholder)
  if (text === placeholder) return text
  return h(
    NEllipsis,
    { style: 'max-width: 100%', tooltip: { width: 360 } },
    { default: () => text }
  )
}

/**
 * 日期时间单元格：统一按本地时区展示 YYYY-MM-DD HH:mm，避免各页直接输出 ISO 串。
 * 值无法解析时原样输出（不吞掉非日期内容）。
 */
export function renderDateTime(value?: string | number | null, placeholder = '—'): VNodeChild {
  if (value == null || value === '') return placeholder
  const time = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(time)) return cellText(value, placeholder)
  return h('span', { class: 'table-datetime' }, formatDateTime(value, placeholder))
}

/**
 * 纯日期单元格：仅展示 YYYY-MM-DD（本地时区），用于无时间分量的日期字段；
 * 与 renderDateTime 区分——后者保留 HH:mm。无法解析时原样输出（不吞掉非日期内容）。
 */
export function renderDate(value?: string | number | null, placeholder = '—'): VNodeChild {
  if (value == null || value === '') return placeholder
  const time = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(time)) return cellText(value, placeholder)
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return cellText(value, placeholder)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h('span', { class: 'table-datetime' }, `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`)
}

export function renderTableLink(label: string, onClick: () => void): VNodeChild {
  if (!label || label === '-') return '-'
  return h(TableLink, { label, onClick })
}

export function renderStatusTag(
  status?: string,
  meta: Record<string, { label: string; type?: TagProps['type'] }> = {}
): VNodeChild {
  const resolved = resolveStatusLabel(status, meta)
  return h(
    NTag,
    {
      size: 'small',
      round: true,
      bordered: true,
      class: 'community-status-tag',
      type: resolved.type ?? 'default'
    },
    { default: () => resolved.label }
  )
}

/** 表格行内轻量操作按钮，遵循 Naive UI quaternary 规范 */
export function renderTableActionButton(
  label: string,
  onClick?: () => void,
  options: {
    type?: ButtonProps['type']
    icon?: unknown
    disabled?: boolean
  } = {}
): VNodeChild {
  const { type = 'default', icon, disabled } = options
  return h(
    NButton,
    {
      size: 'small',
      quaternary: true,
      type,
      disabled,
      onClick
    },
    {
      icon: icon
        ? () => h(NIcon, { size: 16 }, { default: () => h(icon as any) })
        : undefined,
      default: () => label
    }
  )
}

export function renderEditAction(onClick: () => void, label = '编辑'): VNodeChild {
  return renderTableActionButton(label, onClick, { type: 'primary', icon: CreateOutline })
}

export function renderDangerAction(onClick: () => void, label = '移除'): VNodeChild {
  return renderTableActionButton(label, onClick, { type: 'error', icon: TrashOutline })
}

export function renderTableActionCell(actions: VNodeChild[]): VNodeChild {
  return h('div', { class: 'table-action-cell' }, actions.filter(Boolean))
}
