/**
 * 星语全量界面覆盖表。
 *
 * 它是前端实现的路由契约，不是产品文档：每一项都对应一张需要交付的
 * 独立界面。`admin` 项保留在 MarsAdmin（xingyu-admin）实现，避免把
 * 管理台技术栈误迁入社区 Web。
 */
export type ScreenOwner = "web" | "admin";

export type ScreenSpec = {
  id: string;
  name: string;
  route: string;
  owner: ScreenOwner;
};

const screens = (prefix: string, owner: ScreenOwner, items: Array<[string, string]>): ScreenSpec[] =>
  items.map(([name, route], index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    name,
    route,
    owner,
  }));

export const SCREEN_REGISTRY: ScreenSpec[] = [
  ...screens("PUB", "web", [
    ["首页（访客）", "/"], ["首页（登录态）", "/?mode=member"], ["发现", "/discover"],
    ["搜索起始页", "/search"], ["搜索结果", "/search?q={query}"], ["话题广场", "/topics"],
    ["话题详情", "/topics/{slug}"], ["文章详情", "/articles/{articleId}"], ["文章图片查看", "/articles/{articleId}/media/{mediaId}"],
    ["系列详情", "/series/{seriesId}"], ["系列阅读", "/series/{seriesId}/read"], ["个人主页", "/users/{username}"],
    ["创作空间", "/spaces/{spaceSlug}"], ["公开收藏夹", "/collections/{collectionId}"], ["星系主页", "/galaxies/{slug}"], ["星系内容流", "/galaxies/{slug}/content"], ["公开内容状态页", "/content/{objectType}/{objectId}/status"],
  ]),
  ...screens("AUTH", "web", [
    ["登录", "/login"], ["注册", "/register"], ["邮箱验证", "/verify-email"], ["忘记密码", "/forgot-password"],
    ["重置密码", "/reset-password"], ["账号受限", "/account/status"], ["兴趣选择", "/onboarding/interests"],
    ["推荐关注", "/onboarding/follows"], ["完善资料", "/onboarding/profile"],
  ]),
  ...screens("USR", "web", [
    ["我的主页预览", "/me"], ["我的书架", "/me/bookshelf"], ["阅读历史", "/me/history"], ["我的收藏夹", "/me/collections"],
    ["收藏夹详情", "/me/collections/{collectionId}"], ["关注管理", "/me/following"], ["粉丝管理", "/me/followers"],
    ["我的动态", "/me/moments"], ["我的评论", "/me/comments"], ["我的点赞", "/me/likes"], ["我的徽章", "/me/badges"],
    ["我的星系", "/me/galaxies"], ["我的群聊", "/me/groups"], ["创作数据", "/me/insights"],
    ["公开资料编辑", "/me/profile"], ["成长记录", "/me/growth"], ["个人关系请求", "/me/requests"], ["个人空状态", "/me/empty"],
  ]),
  ...screens("CRT", "web", [
    ["创作工作台", "/studio"], ["内容管理总览", "/studio/content"], ["文章管理", "/studio/articles"], ["草稿箱", "/studio/drafts"],
    ["审核中内容", "/studio/reviewing"], ["被退回内容", "/studio/returned"], ["回收站", "/studio/trash"], ["文章编辑器", "/studio/articles/{articleId}/edit"],
    ["新建文章", "/studio/articles/new"], ["发布设置", "/studio/articles/{articleId}/publish"], ["提交审核", "/studio/articles/{articleId}/submit"],
    ["审核详情", "/studio/submissions/{submissionId}"], ["版本历史", "/studio/articles/{articleId}/versions"], ["系列管理", "/studio/series"],
    ["系列编辑", "/studio/series/{seriesId}/edit"], ["新建系列", "/studio/series/new"], ["章节编排", "/studio/series/{seriesId}/chapters"],
    ["动态创作", "/studio/moments/new"], ["创作素材库", "/studio/assets"], ["创作协作邀请", "/studio/collaboration"],
  ]),
  ...screens("SOC", "web", [
    ["动态广场", "/moments"], ["动态详情", "/moments/{momentId}"], ["评论详情", "/comments/{commentId}"],
    ["通知中心", "/notifications"], ["活动广场", "/events"], ["活动详情", "/events/{eventId}"],
    ["活动投稿", "/events/{eventId}/submit"], ["推荐反馈", "/feedback/recommendations"],
  ]),
  ...screens("MSG", "web", [
    ["私信会话", "/messages/direct/{conversationId}"], ["新建私信", "/messages/new"], ["群聊会话", "/messages/group/{conversationId}"],
    ["创建群聊", "/messages/groups/new"], ["群资料", "/messages/group/{conversationId}/info"], ["群成员", "/messages/group/{conversationId}/members"],
    ["群公告", "/messages/group/{conversationId}/announcement"], ["群申请管理", "/messages/group/{conversationId}/applications"],
    ["群设置", "/messages/group/{conversationId}/settings"], ["消息搜索", "/messages/search"], ["消息收藏", "/messages/saved"],
    ["会话媒体", "/messages/{conversationId}/media"], ["会话文件", "/messages/{conversationId}/files"], ["聊天用户资料", "/messages/users/{username}"], ["聊天空状态", "/messages/empty"],
  ]),
  ...screens("SET", "web", [
    ["设置总览", "/settings"], ["账号设置", "/settings/account"], ["个人资料设置", "/settings/profile"], ["安全设置", "/settings/security"],
    ["设备与会话", "/settings/security/sessions"], ["修改邮箱", "/settings/security/email"], ["重新验证", "/settings/security/re-authenticate"],
    ["隐私设置", "/settings/privacy"], ["通知设置", "/settings/notifications"], ["搜索历史设置", "/settings/search-history"],
    ["数据导出与注销", "/settings/data"], ["偏好与无障碍", "/settings/preferences"],
  ]),
  ...screens("GOV", "web", [
    ["举报提交", "/reports/new"], ["举报详情", "/reports/{reportId}"], ["我的举报", "/reports"], ["申诉提交", "/appeals/new"],
    ["申诉详情", "/appeals/{appealId}"], ["社区规则", "/rules"], ["帮助中心", "/help"],
  ]),
  ...screens("ADM", "admin", [
    ["管理工作台", "/admin/dashboard"], ["用户列表", "/admin/users"], ["用户详情", "/admin/users/{userId}"], ["内容审核队列", "/admin/reviews"], ["审核详情", "/admin/reviews/{reviewId}"],
    ["治理案件工作台", "/admin/cases"], ["治理案件详情", "/admin/cases/{caseId}"], ["举报队列", "/admin/reports"], ["申诉队列", "/admin/appeals"],
    ["文章运营", "/admin/content/articles"], ["动态运营", "/admin/content/moments"], ["系列运营", "/admin/content/series"], ["话题运营", "/admin/topics"], ["标签运营", "/admin/tags"],
    ["星系运营", "/admin/galaxies"], ["群聊治理", "/admin/groups"], ["活动运营", "/admin/events"], ["精选运营", "/admin/featured"],
    ["公告中心", "/admin/announcements"], ["搜索运营", "/admin/search"], ["推荐运营", "/admin/recommendations"], ["数据看板", "/admin/analytics"],
    ["审核规则", "/admin/policies/review"], ["治理规则", "/admin/policies/governance"], ["角色权限", "/admin/security/roles"], ["管理员账号", "/admin/security/admins"],
    ["审计日志", "/admin/audit-logs"], ["邮件设置", "/admin/system/email"], ["短信设置", "/admin/system/sms"], ["API 安全设置", "/admin/system/api-security"],
  ]),
  ...screens("SYS", "web", [
    ["星语指南首页", "/guide"], ["指南文章", "/guide/{slug}"], ["站点公告", "/announcements"], ["公告详情", "/announcements/{announcementId}"],
    ["维护中", "/system/maintenance"], ["无权限", "/system/forbidden"], ["内容不存在", "/system/not-found"], ["网络离线", "/system/offline"],
    ["请求过于频繁", "/system/rate-limited"], ["服务异常", "/system/error"],
  ]),
];

export const COMPONENT_REGISTRY = [
  "AppShell", "MobileTabBar", "GlobalSearch", "UserMenu", "PageHero", "SectionHeading",
  "ContentCard", "ContentRow", "AuthorIdentity", "TopicChip", "GalaxyBadge", "SeriesProgress",
  "FollowButton", "ReactionBar", "CommentThread", "ShareSheet", "ReportDialog", "EmptyState",
  "ErrorState", "LoadingSkeleton", "FilterBar", "Pagination", "NotificationItem", "ConversationItem",
  "MessageComposer", "MessageBubble", "GroupMemberRow", "EditorToolbar", "EditorCanvas", "PublishPanel",
  "RevisionTimeline", "SettingsNav", "DataTable", "ModerationCaseCard", "StatusBanner", "ConfirmDialog",
] as const;

export const SCREEN_TOTAL = SCREEN_REGISTRY.length;
export const COMPONENT_TOTAL = COMPONENT_REGISTRY.length;

if (SCREEN_TOTAL !== 146 || COMPONENT_TOTAL !== 36) {
  throw new Error(`Screen registry mismatch: ${SCREEN_TOTAL} screens, ${COMPONENT_TOTAL} components.`);
}
