import { h, type VNodeChild } from 'vue'
import { NButton, NIcon, NTag } from 'naive-ui'
import type { ButtonProps, TagProps } from 'naive-ui'
import { CreateOutline, TrashOutline } from '@vicons/ionicons5'
import TableLink from '@/components/community/TableLink.vue'
import { resolveStatusLabel } from '@/utils/community-display'

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
