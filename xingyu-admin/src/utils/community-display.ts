import type { TagProps } from 'naive-ui'

export interface StatusMeta {
  label: string
  type?: TagProps['type']
}

/** 社区内容通用状态 */
export const COMMON_CONTENT_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: '草稿', type: 'info' },
  IN_REVIEW: { label: '审核中', type: 'warning' },
  PUBLISHED: { label: '已发布', type: 'success' },
  TRASHED: { label: '已回收', type: 'default' },
  ACTIVE: { label: '运营中', type: 'success' },
  ARCHIVED: { label: '已归档', type: 'default' }
}

/** 治理 / 审核队列状态 */
export const MODERATION_STATUS_META: Record<string, StatusMeta> = {
  OPEN: { label: '待处理', type: 'warning' },
  PENDING: { label: '待处理', type: 'warning' },
  SUBMITTED: { label: '待审核', type: 'info' },
  ACCEPTED: { label: '已通过', type: 'success' },
  PROCESSING: { label: '处理中', type: 'warning' },
  DECIDED: { label: '已结案', type: 'default' },
  RESOLVED: { label: '已解决', type: 'success' },
  REJECTED: { label: '已拒绝', type: 'error' },
  APPROVED: { label: '已通过', type: 'success' },
  UPHELD: { label: '举报成立', type: 'error' },
  DISMISSED: { label: '举报驳回', type: 'default' }
}

/** 公告状态 */
export const ANNOUNCEMENT_STATUS_META: Record<string, StatusMeta> = {
  PUBLISHED: { label: '已发布', type: 'success' },
  DRAFT: { label: '已下线', type: 'default' },
  ARCHIVED: { label: '已归档', type: 'warning' }
}

/** 社区用户账号状态 */
export const COMMUNITY_USER_STATUS_META: Record<string, StatusMeta> = {
  PENDING_REVIEW: { label: '待审核', type: 'warning' },
  ACTIVE: { label: '正常', type: 'success' },
  REJECTED: { label: '审核拒绝', type: 'error' },
  SUSPENDED: { label: '已停用', type: 'default' },
  DELETED: { label: '已删除', type: 'default' }
}

/** 社区用户身份（后端默认注册角色为小写 user） */
export const COMMUNITY_USER_ROLE_LABELS: Record<string, string> = {
  user: '普通用户',
  USER: '普通用户',
  member: '普通成员',
  MEMBER: '普通成员',
  creator: '创作者',
  CREATOR: '创作者',
  admin: '管理员',
  ADMIN: '管理员'
}

export function formatCommunityUserRole(role?: string | null): string {
  if (!role || !role.trim()) return COMMUNITY_USER_ROLE_LABELS.user
  const key = role.trim()
  return COMMUNITY_USER_ROLE_LABELS[key] ?? COMMUNITY_USER_ROLE_LABELS[key.toUpperCase()] ?? key
}

/** 筛选项 value -> 后端可能出现的 role 值（含历史别名） */
const COMMUNITY_USER_ROLE_FILTER_GROUPS: Record<string, readonly string[]> = {
  user: ['user', 'USER', 'member', 'MEMBER'],
  creator: ['creator', 'CREATOR'],
  admin: ['admin', 'ADMIN']
}

export function matchesCommunityUserRole(role: string | null | undefined, filterValue: string): boolean {
  const aliases = COMMUNITY_USER_ROLE_FILTER_GROUPS[filterValue.trim().toLowerCase()]
  const actual = (role?.trim() || 'user').toLowerCase()
  if (!aliases) return actual === filterValue.trim().toLowerCase()
  return aliases.some((item) => item.toLowerCase() === actual)
}

export const COMMUNITY_USER_ROLE_FILTER_OPTIONS = [
  { label: '普通用户', value: 'user' },
  { label: '创作者', value: 'creator' },
  { label: '管理员', value: 'admin' }
] as const

/** 对象类型中文 */
export const OBJECT_TYPE_LABELS: Record<string, string> = {
  ARTICLE: '文章',
  MOMENT: '动态',
  SERIES: '系列',
  USER: '用户',
  COMMENT: '评论'
}

const MERGED_STATUS_META: Record<string, StatusMeta> = {
  ...COMMON_CONTENT_STATUS_META,
  ...MODERATION_STATUS_META,
  ...ANNOUNCEMENT_STATUS_META,
  ...COMMUNITY_USER_STATUS_META,
  ENABLED: { label: '启用', type: 'success' },
  DISABLED: { label: '停用', type: 'default' }
}

export const AUTHOR_COLUMN_TITLE = '作者（昵称|用户名）'

function joinAuthorParts(left: string, right: string): string {
  return `${left} | ${right}`
}

function normalizeAuthorFallback(value: string): string {
  return value
    .replace(/^[（(]\s*|\s*[）)]$/g, '')
    .replace(/\//g, '|')
    .replace(/\s*\|\s*/g, ' | ')
    .trim()
}

export function formatAuthorLabel(
  displayName?: string | null,
  username?: string | null,
  fallback?: string | null
): string {
  const nickname = displayName?.trim()
  const handle = username?.trim()
  if (nickname && handle) return joinAuthorParts(nickname, handle)
  if (nickname) return joinAuthorParts(nickname, nickname)
  if (handle) return joinAuthorParts(handle, handle)
  if (fallback?.trim()) {
    const value = normalizeAuthorFallback(fallback.trim())
    if (value.includes('|')) return value
    return joinAuthorParts(value, value)
  }
  return '-'
}

export function formatObjectType(type?: string | null): string {
  if (!type) return '-'
  return OBJECT_TYPE_LABELS[type] ?? type
}

export function resolveContentStatus(
  statusMeta: Record<string, StatusMeta>,
  status?: string
): StatusMeta {
  if (!status) return { label: '未知', type: 'default' }
  return statusMeta[status] ?? COMMON_CONTENT_STATUS_META[status] ?? { label: status, type: 'default' }
}

export function resolveStatusLabel(
  status?: string,
  extraMeta: Record<string, StatusMeta> = {}
): StatusMeta {
  if (!status) return { label: '未知', type: 'default' }
  return extraMeta[status] ?? MERGED_STATUS_META[status] ?? { label: status, type: 'default' }
}

export function buildDetailFields(
  entries: Array<{ label: string; value?: string | number | null; multiline?: boolean }>
): Array<{ label: string; value: string; multiline?: boolean }> {
  return entries
    .map((entry) => ({
      label: entry.label,
      value: entry.value == null || entry.value === '' ? '-' : String(entry.value),
      multiline: entry.multiline
    }))
    .filter((entry) => entry.value !== '-')
}
