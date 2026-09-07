export type NavigationItem = {
  label: string
  key: string
  icon: string
}

export type NavigationGroup = {
  label: string
  key: string
  icon: string
  children: NavigationItem[]
}

export type NavigationNode =
  | ({ type: 'item' } & NavigationItem)
  | ({ type: 'group' } & NavigationGroup)

/** 侧栏信息架构：按运营工作流分组，已落地页面优先指向真实路由。 */
export const adminNavigation: NavigationNode[] = [
  { type: 'item', label: '运营总览', key: '/dashboard', icon: 'AnalyticsOutline' },
  {
    type: 'group',
    label: '内容管理',
    key: 'group-content',
    icon: 'NewspaperOutline',
    children: [
      { label: '公共话题', key: '/community/topics', icon: 'PricetagOutline' },
      { label: '内容审核', key: '/community/review', icon: 'CheckmarkCircleOutline' },
      { label: '文章运营', key: '/community/operations/articles', icon: 'DocumentTextOutline' },
      { label: '动态运营', key: '/community/operations/moments', icon: 'ChatbubbleEllipsesOutline' },
      { label: '系列运营', key: '/community/operations/series', icon: 'AlbumsOutline' }
    ]
  },
  {
    type: 'group',
    label: '社区空间',
    key: 'group-community',
    icon: 'EarthOutline',
    children: [
      { label: '社区用户', key: '/community/users', icon: 'PeopleOutline' },
      { label: '星系', key: '/community/operations/galaxies', icon: 'GitNetworkOutline' },
      { label: '活动', key: '/community/operations/events', icon: 'CalendarOutline' },
      { label: '指南', key: '/community/operations/guides', icon: 'BookOutline' },
      { label: '公告中心', key: '/community/operations/announcements', icon: 'NotificationsOutline' },
      { label: '群聊治理', key: '/community/operations/groups', icon: 'ChatbubblesOutline' },
      { label: '标签运营', key: '/community/operations/tags', icon: 'PricetagsOutline' },
    ]
  },
  {
    type: 'group',
    label: '审核与治理',
    key: 'group-governance',
    icon: 'ShieldOutline',
    children: [
      { label: '治理案件', key: '/community/moderation', icon: 'ShieldCheckmarkOutline' },
      { label: '举报队列', key: '/community/moderation/reports', icon: 'AlertCircleOutline' },
      { label: '申诉队列', key: '/community/moderation/appeals', icon: 'SwapHorizontalOutline' }
    ]
  },
  {
    type: 'group',
    label: '平台配置',
    key: 'group-platform',
    icon: 'CogOutline',
    children: [
      { label: '基础与安全', key: '/system/config', icon: 'LockClosedOutline' },
      { label: '系统通知', key: '/message/notice', icon: 'MailOutline' },
      { label: '文件资源', key: '/system/file', icon: 'FolderOpenOutline' },
      { label: '存储配置', key: '/system/config?tab=storage', icon: 'CloudOutline' }
    ]
  },
  {
    type: 'group',
    label: '系统运维',
    key: 'group-ops',
    icon: 'ServerOutline',
    children: [
      { label: '平台账号', key: '/system/user', icon: 'PersonOutline' },
      { label: '角色权限', key: '/system/role', icon: 'KeyOutline' },
      { label: '菜单权限', key: '/system/menu', icon: 'MenuOutline' },
      { label: '字典管理', key: '/system/dict', icon: 'LibraryOutline' },
      { label: '定时任务', key: '/monitor/job', icon: 'TimerOutline' },
      { label: '在线用户', key: '/monitor/online', icon: 'PeopleCircleOutline' },
      { label: '操作日志', key: '/log/operlog', icon: 'ClipboardOutline' },
      { label: '登录日志', key: '/log/loginlog', icon: 'LogInOutline' }
    ]
  }
]

export const navigationLabels: Record<string, string> = {
  '/dashboard': '运营总览',
  '/community/users': '社区用户',
  '/community/topics': '公共话题',
  '/community/operations/galaxies': '星系',
  '/community/operations/events': '活动',
  '/community/operations/guides': '指南',
  '/community/operations/announcements': '公告中心',
  '/community/operations/groups': '群聊治理',
  '/community/operations/tags': '标签运营',
  '/community/review': '内容审核',
  '/community/operations/articles': '文章运营',
  '/community/operations/moments': '动态运营',
  '/community/operations/series': '系列运营',
  '/community/moderation': '治理案件',
  '/community/moderation/reports': '举报队列',
  '/community/moderation/appeals': '申诉队列',
  '/system/config': '基础与安全',
  '/message/notice': '系统通知',
  '/system/file': '文件资源',
  '/system/file-config': '存储配置',
  '/system/user': '平台账号',
  '/system/role': '角色权限',
  '/system/menu': '菜单权限',
  '/system/dict': '字典管理',
  '/monitor/job': '定时任务',
  '/monitor/online': '在线用户',
  '/log/operlog': '操作日志',
  '/log/loginlog': '登录日志',
  '/profile': '个人中心'
}

export function flattenNavigationIcons(): Record<string, string> {
  const icons: Record<string, string> = {}
  for (const node of adminNavigation) {
    if (node.type === 'item') {
      icons[node.key] = node.icon
      continue
    }
    for (const child of node.children) {
      icons[child.key] = child.icon
    }
  }
  return icons
}

function findNavigationGroup(path: string): string | undefined {
  for (const node of adminNavigation) {
    if (node.type !== 'group') continue
    if (node.children.some((child) => path === child.key || path.startsWith(`${child.key}/`))) {
      return node.label
    }
  }
  return undefined
}

function resolveNavigationTitle(path: string): string | undefined {
  if (navigationLabels[path]) return navigationLabels[path]

  const matched = Object.entries(navigationLabels)
    .filter(([key]) => path.startsWith(`${key}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]

  return matched?.[1]
}

export function buildNavigationBreadcrumbs(path: string): Array<{ path: string; title: string }> {
  if (path === '/dashboard') {
    return [{ path: '/dashboard', title: '运营总览' }]
  }

  if (path === '/profile') {
    return [{ path: '/dashboard', title: '运营总览' }, { path: '/profile', title: '个人中心' }]
  }

  const group = findNavigationGroup(path)
  const title = resolveNavigationTitle(path)
  if (group && title) {
    return [{ path, title: group }, { path, title }]
  }

  if (title) {
    return [{ path, title }]
  }

  return []
}
