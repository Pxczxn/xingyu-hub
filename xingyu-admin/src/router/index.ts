import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { MenuInfo } from '@/api/auth'

// 动态导入所有页面组件
const modules = import.meta.glob('/src/views/**/*.vue')

// iframe 通用组件
const IframeComponent = () => import('@/views/common/iframe.vue')

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '运营概览', icon: 'AnalyticsOutline' }
      },
      // 个人中心
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人中心', icon: 'PersonOutline' }
      },
      ...(import.meta.env.DEV ? [{
        path: 'prototype/activity-review',
        name: 'PrototypeActivityReview',
        component: () => import('@/views/community/events/index.vue'),
        meta: { title: '活动审核验收', requiresAuth: false }
      }] : []),
      // 系统管理
      {
        path: 'system/user',
        name: 'SystemUser',
        component: () => import('@/views/system/user/index.vue'),
        meta: { title: '用户管理', icon: 'PersonOutline' }
      },
      {
        path: 'system/role',
        name: 'SystemRole',
        component: () => import('@/views/system/role/index.vue'),
        meta: { title: '角色管理', icon: 'KeyOutline' }
      },
      {
        path: 'system/menu',
        name: 'SystemMenu',
        component: () => import('@/views/system/menu/index.vue'),
        meta: { title: '菜单管理', icon: 'MenuOutline' }
      },
      {
        path: 'system/dict',
        name: 'SystemDict',
        component: () => import('@/views/system/dict/index.vue'),
        meta: { title: '字典管理', icon: 'LibraryOutline' }
      },
      {
        path: 'system/config',
        name: 'SystemConfig',
        component: () => import('@/views/system/config/index.vue'),
        meta: { title: '系统配置', icon: 'LockClosedOutline' }
      },
      {
        path: 'system/file',
        name: 'SystemFile',
        component: () => import('@/views/system/file/index.vue'),
        meta: { title: '文件列表', icon: 'FolderOpenOutline' }
      },
      {
        path: 'system/file-config',
        name: 'SystemFileConfig',
        redirect: { path: '/system/config', query: { tab: 'storage' } },
        meta: { title: '文件配置', icon: 'CloudOutline' }
      },
      // 消息中心
      {
        path: 'message/notice',
        name: 'MessageNotice',
        component: () => import('@/views/message/notice/index.vue'),
        meta: { title: '系统通知', icon: 'MailOutline' }
      },
      {
        path: 'message/chat',
        name: 'MessageChat',
        component: () => import('@/views/message/chat/index.vue'),
        meta: { title: '会话巡查', icon: 'ChatbubbleOutline' }
      },
      // 系统日志
      {
        path: 'log/operlog',
        name: 'LogOper',
        component: () => import('@/views/log/operlog/index.vue'),
        meta: { title: '操作日志', icon: 'ClipboardOutline' }
      },
      {
        path: 'log/loginlog',
        name: 'LogLogin',
        component: () => import('@/views/log/loginlog/index.vue'),
        meta: { title: '登录日志', icon: 'LogInOutline' }
      },
      // 系统监控
      {
        path: 'monitor/online',
        name: 'MonitorOnline',
        component: () => import('@/views/monitor/online/index.vue'),
        meta: { title: '在线用户', icon: 'PeopleCircleOutline' }
      },
      {
        path: 'monitor/job',
        name: 'MonitorJob',
        component: () => import('@/views/monitor/job/index.vue'),
        meta: { title: '定时任务', icon: 'TimerOutline' }
      },
      {
        path: 'monitor/cache',
        name: 'MonitorCache',
        component: () => import('@/views/monitor/cache/index.vue'),
        meta: { title: '缓存监控', icon: 'ServerOutline' }
      },
      {
        path: 'monitor/api-access',
        name: 'MonitorApiAccess',
        component: () => import('@/views/monitor/api-access/index.vue'),
        meta: { title: 'API访问统计', icon: 'StatsChartOutline' }
      },
      {
        path: 'monitor/server',
        name: 'MonitorServer',
        component: () => import('@/views/monitor/server/index.vue'),
        meta: { title: '服务监控', icon: 'DesktopOutline' }
      },
      {
        path: 'monitor/server-manager',
        name: 'ServerManager',
        component: () => import('@/views/monitor/server-manager/index.vue'),
        meta: { title: '服务器管理', icon: 'ServerOutline' }
      },
      {
        path: 'monitor/druid',
        name: 'MonitorDruid',
        component: IframeComponent,
        meta: { title: 'Druid监控', icon: 'PieChartOutline', frameSrc: '/druid/index.html' }
      },
      // 开发工具
      {
        path: 'tool/gen',
        name: 'ToolGen',
        component: () => import('@/views/tool/gen/index.vue'),
        meta: { title: '代码生成', icon: 'CodeSlashOutline' }
      },
      {
        path: 'community/topics',
        name: 'CommunityTopics',
        component: () => import('@/views/topics/index.vue'),
        meta: { title: '公共话题', icon: 'PricetagOutline' }
      },
      { path: 'community/topics/:topicId/edit', component: () => import('@/views/topics/index.vue'), meta: { title: '编辑话题' } },
      { path: 'community/topics/:topicId/merge', component: () => import('@/views/topics/index.vue'), meta: { title: '合并话题' } },
      { path: 'community/featured', redirect: '/community/operations/featured' },
      { path: 'community/announcements', redirect: '/community/operations/announcements' },
      { path: 'community/guides', redirect: '/community/operations/guides' },
      { path: 'community/guides/navigation', redirect: '/community/operations/guides' },
      { path: 'community/reports', redirect: '/community/moderation/reports' },
      { path: 'community/appeals', redirect: '/community/moderation/appeals' },
      { path: 'community/chat-governance', redirect: '/community/operations/groups' },
      { path: 'community/groups', redirect: '/community/operations/groups' },
      {
        path: 'community/users',
        name: 'CommunityUsers',
        component: () => import('@/views/community/users/index.vue'),
        meta: { title: '社区用户', icon: 'PeopleOutline' }
      },
      { path: 'community/users/:userId', component: () => import('@/views/community/users/index.vue'), meta: { title: '用户详情' } },
      {
        path: 'community/review',
        name: 'CommunityReview',
        component: () => import('@/views/community/review/index.vue'),
        meta: { title: '内容审核', icon: 'CheckmarkCircleOutline' }
      },
      { path: 'community/review/:taskId', component: () => import('@/views/community/review/index.vue'), meta: { title: '审核详情' } },
      {
        path: 'community/moderation',
        name: 'CommunityModeration',
        component: () => import('@/views/community/moderation/index.vue'),
        meta: { title: '治理案件', icon: 'ShieldCheckmarkOutline' }
      },
      {
        path: 'community/moderation/reports', name: 'ModerationReports',
        component: () => import('@/views/community/governance-status.vue'), props: { title: '举报队列' },
        meta: { title: '举报队列', icon: 'AlertCircleOutline' }
      },
      {
        path: 'community/moderation/appeals', name: 'ModerationAppeals',
        component: () => import('@/views/community/governance-status.vue'), props: { title: '申诉队列' },
        meta: { title: '申诉队列', icon: 'ChatboxEllipsesOutline' }
      },
      {
        path: 'community/operations/events',
        name: 'OperationEvents',
        component: () => import('@/views/community/events/index.vue'),
        meta: { title: '活动运营', icon: 'PulseOutline' }
      },
      {
        path: 'community/operations/guides',
        name: 'OperationGuides',
        component: () => import('@/views/community/guides/index.vue'),
        meta: { title: '指南运营', icon: 'BookOutline' }
      },
      { path: 'community/guides/:guideId/edit', component: () => import('@/views/community/guides/index.vue'), meta: { title: '编辑指南' } },
      { path: 'community/operations/announcements', name: 'OperationAnnouncements', component: () => import('@/views/community/announcements.vue'), meta: { title: '公告中心', icon: 'NotificationsOutline' } },
      { path: 'community/operations/groups', name: 'OperationGroups', component: () => import('@/views/community/governance-status.vue'), props: { title: '群聊治理' }, meta: { title: '群聊治理', icon: 'ChatbubblesOutline' } },
      { path: 'community/operations/tags', name: 'OperationTags', component: () => import('@/views/topics/index.vue'), meta: { title: '标签运营', icon: 'PricetagsOutline' } },
      {
        path: 'community/operations/galaxies',
        name: 'OperationGalaxies',
        component: () => import('@/views/community/galaxies/index.vue'),
        meta: { title: '星系运营', icon: 'GitNetworkOutline' }
      },
      {
        path: 'community/operations/featured',
        name: 'OperationFeatured',
        component: () => import('@/views/community/featured/index.vue'),
        meta: { title: '精选运营', icon: 'StarOutline' }
      },
      ...[
        ['articles', '文章运营', 'ARTICLE', 'DocumentTextOutline'],
        ['moments', '动态运营', 'MOMENT', 'ChatbubbleEllipsesOutline'],
        ['series', '系列运营', 'SERIES', 'AlbumsOutline']
      ].map(([path, title, assetType, icon]) => ({
        path: `community/operations/${path}`,
        name: `Operation${path[0].toUpperCase()}${path.slice(1)}`,
        component: () => import('@/views/community/content-assets.vue'),
        props: { assetType, title },
        meta: { title, icon }
      })),
      // 页签刷新中转路由
      {
        path: 'redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/redirect/index.vue'),
        meta: { title: '重定向', requiresAuth: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '404', requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 已添加的动态路由
const addedRouteNames = new Set<string>()

/**
 * 根据菜单动态添加新路由（只添加静态路由中没有的）
 */
export function addDynamicRoutes(menus: MenuInfo[]) {
  console.log('[动态路由] 开始处理菜单:', menus)
  
  const addRoutes = (menuList: MenuInfo[]) => {
    for (const menu of menuList) {
      // 只处理菜单类型(type=2)，且有 path
      if (menu.type === 2 && menu.path) {
        const routeName = 'Dynamic-' + menu.id
        
        // 检查是否已经有同路径的静态路由
        const existingRoutes = router.getRoutes()
        const menuPath = menu.path.startsWith('/') ? menu.path.slice(1) : menu.path
        const pathExists = existingRoutes.some(r => r.path === '/' + menuPath || r.path === menuPath)
        
        if (pathExists) {
          console.log(`[动态路由] 跳过(已存在): ${menuPath}`)
          continue
        }
        
        if (addedRouteNames.has(routeName)) {
          console.log(`[动态路由] 跳过(已添加): ${menuPath}`)
          continue
        }
        
        // 判断是否是外链菜单
        if (menu.isFrame === 1 && menu.component) {
          // 外链菜单，使用 iframe 组件
          router.addRoute('Layout', {
            path: menuPath,
            name: routeName,
            component: IframeComponent,
            meta: {
              title: menu.name,
              icon: menu.icon,
              permission: menu.permission,
              frameSrc: menu.component  // 外链地址存在 component 字段
            }
          })
          addedRouteNames.add(routeName)
          console.log(`[动态路由] ✓ 添加外链成功: ${menuPath} -> ${menu.component}`)
        } else if (menu.component) {
          // 普通菜单，加载组件
          const componentName = menu.component.startsWith('/') ? menu.component.slice(1) : menu.component
          const componentPath = `/src/views/${componentName}.vue`
          const component = modules[componentPath]
          
          console.log(`[动态路由] 处理: path=${menuPath}, component=${componentPath}, 组件存在=${!!component}`)
          
          if (component) {
            router.addRoute('Layout', {
              path: menuPath,
              name: routeName,
              component: component,
              meta: {
                title: menu.name,
                icon: menu.icon,
                permission: menu.permission
              }
            })
            addedRouteNames.add(routeName)
            console.log(`[动态路由] ✓ 添加成功: ${menuPath}`)
          } else {
            console.warn(`[动态路由] ✗ 组件不存在: ${componentPath}`)
          }
        }
      }
      
      // 递归处理子菜单
      if (menu.children && menu.children.length > 0) {
        addRoutes(menu.children)
      }
    }
  }
  
  addRoutes(menus)
  console.log('[动态路由] 当前所有路由:', router.getRoutes().map(r => r.path))
}

/**
 * 重置动态路由
 */
export function resetRouter() {
  addedRouteNames.forEach(name => {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  })
  addedRouteNames.clear()
}

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()

  document.title = `${to.meta.title || ''} - 星语管理端`

  if (to.meta.requiresAuth === false) {
    next()
    return
  }

  if (!userStore.token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  if (!userStore.user) {
    try {
      await userStore.getInfo()
      // 添加动态路由（只添加新的，不影响已有的）
      addDynamicRoutes(userStore.menus)
      next({ ...to, replace: true })
      return
    } catch (error) {
      userStore.logout()
      next({ name: 'Login' })
      return
    }
  }

  next()
})

export default router
