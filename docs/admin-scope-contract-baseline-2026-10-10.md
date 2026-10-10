# Admin Scope & Contract Baseline Report

> 2026-10-10 · 只读调查。全部结论基于代码与实测命令，未依据产品文档假定任何功能。
> 仓库现场：分支 `pxczxn`，HEAD `f21616a`，279 个历史 WIP 文件未触碰。本轮零修改。

---

## 1. 管理端真实技术栈与架构

**前端**（`xingyu-admin`，Vue 3 + Naive UI + Pinia + Vite，约 31k 文件的完整工程）：
- 20 个 API 模块（`src/api/`：auth、moderation、review、community-users、events、topics、galaxies、featured、announcements、operations、search-index、monitor、system、server、wechat、org、gen、guide-pages、message、customer）。
- `src/router/index.ts`（405 行）：**30+ 静态路由**（dashboard、system/\*、message/\*、log/\*、monitor/\*、tool/gen、community/\*）+ **基于后端菜单的动态路由**（`addDynamicRoutes`，type=2 菜单映射 `/src/views/**` 组件）。
- `src/utils/request.ts`：axios 封装，响应拦截器完整（非 200 → reject + 全局错误提示；401 → 登出；支持加密信封解密）。**无虚假成功路径**（业务成功提示均在 await 成功后）。

**后端**（`xingyu-admin-api` 模块，41 个 Controller）：auth、system（user/role/menu/dict/config/file/dept/post）、monitor（dashboard/job/cache/server/api-access/search-index）、community（users/review/moderation/moderation-queue/topic/galaxy/featured/event/guide/announcement/group/content-asset）、operations-overview、tool-gen、wechat、customer、file。

## 2. 权限机制（关键架构事实）

**双会话体系，隔离成立**：
- 社区端：`satoken` 头 → `CommunityAuthInterceptor` → `community_session` 表（自定义 token，Studio 轮已验证）。
- 管理端：`/api/v1/admin/**` → `SaTokenConfig.java:22-37` `StpUtil.checkLogin()`（sa-token 存储，账号源 `sys_user`）。
- 交叉验证：社区 token 存 `community_session` 表、不在 sa-token 存储 → 无法通过 admin `checkLogin`；反之 admin token 不在 `community_session` 表 → `requireActiveSession` 拒绝。**双向隔离成立**。

**权限模型缺陷（P1）**：
- `SaTokenConfig` 对 `/api/v1/admin/**` **只有 `checkLogin()`，无 `checkRole/checkPermission`**。`sys_user` 的角色（`getRoleCodes`）仅返回给前端控制菜单显示——**服务端不执行角色校验**。任何 userType=admin 的 sys_user 无论什么角色都能调用全部 admin API（含用户删除、审核决策、系统配置）。
- 弱化细节：`PasswordLoginStrategy.checkUserType`（:139-142）对 `userType` 为**空/ null 的 sys_user 直接放行** admin 登录。
- 免登录白名单：`/api/v1/admin/files/**`、`sys/file/preview/**`、`download/**`（与既有 `/files/**` 无鉴权直出债务同源）。
- 前端路由守卫（router/index.ts:373-403）只查 token+user，静态路由无 permission 元信息——与后端一致地"只认证不授权"。

## 3. 功能域矩阵（以代码为准）

| 功能域 | 实现状态 | 证据 |
|---|---|---|
| 工作台/运营概览 | 已实现，缺验证 | OperationsOverviewController + dashboard/index.vue（422 行，真实 API） |
| 系统用户/角色/菜单/字典/配置/文件 | 已实现 + 审计注解 | SysUserController `@Log`(:88/:99/:110)，LogAspect AOP 写 sys_oper_log |
| 操作/登录日志、在线用户、定时任务、缓存/服务监控、API 统计 | 已实现，缺验证 | SysOperLog/LoginLogController、MonitorController、ApiAccessLogController |
| 内容审核（文章/评论） | 已实现 + 部分验证 | AdminReviewController 调 ReviewService（**与用户端同一 Service，状态机天然一致**——Studio 轮 6/6 集成测试覆盖 decide 主闭环） |
| 举报/申诉队列 | 已实现，缺验证 | AdminModerationQueueController（reports/appeals GET + decide POST）；governance-status.vue 真实调用+确认弹窗 |
| 公共话题 | 已实现，缺验证 | AdminTopicController + topics/index.vue（含编辑/合并路由） |
| 公告/活动/指南/精选/星系 | 已实现，缺验证 | AdminAnnouncement/Event/Guide/Featured/GalaxyController（events 有 WIP 修改中） |
| 文章/动态/系列运营 | 已实现，缺验证 | AdminContentAssetController（ARTICLE/MOMENT/SERIES 三态复用 content-assets.vue） |
| **群聊治理** | **部分实现 + UI 虚假操作** | **`AdminGroupController` 只有 `GET /operations/groups`，无 decide 端点**；governance-status.vue 在 /groups 路径仍渲染"认定违规/驳回"按钮，`submit()` 的 kind 判定（:252）`appeals ? appeals : reports` 会把群聊案件 ID 提交到 `/moderation/reports/{id}/decide`——后端无对应能力，按钮注定失败或误打举报域 |
| 用户/角色与权限的服务端执行 | **部分实现** | 仅 checkLogin；见第 2 节 |
| 社区用户管理 | 已实现，缺验证 | CommunityUserAdminService + AdminCommunityUserController |
| 代码生成/服务器管理/微信 | 已实现，缺验证 | GenController/SysServerController/WechatController（未深查） |
| Druid 监控 | iframe 外链 | router :157-161 |

**虚假操作清单（有证据）**：仅群聊治理决策按钮一处（上述）。

## 4. 关键契约一致性

- **审核状态迁移**：管理端 decide 与用户端共用 `ReviewService`（APPROVED→发布链、REJECTED→回 DRAFT、重试、事件外流），契约一致性由 Studio 轮测试保证 ✅。
- **举报/申诉 decide**：AdminModerationQueueController 独立端点；前端 decision 枚举 UPHELD/DISMISSED（reports）、APPROVED/REJECTED（appeals）——与后端枚举一致性**未逐值核验**（列入下轮深查）。
- **失败反馈**：request.ts 拦截器统一 reject + 提示，governance-status/review 页 catch 后 error 提示——**未发现虚假成功反馈**。
- **审计记录**：`@Log` 注解仅覆盖 **sys 域**控制器；**community 域 admin 控制器 `@Log` 使用数为 0**——内容审核决策、举报判定、用户封禁/恢复等敏感操作**不产生操作日志**（P1）。事务性：决定类操作走 Service 层事务（ModerationService/ReviewService），与用户端一致。
- **危险操作确认**：前端决策均有确认弹窗（openDecision modal）✅。

## 5. 测试覆盖现状

后端 41 个 admin Controller 对应的集成测试：**仅 2 个**——`CommentModerationRestoreIntegrationTest`、`DefaultAdminPasswordGuardTest`（+ Studio 轮的 ReviewService 状态机测试间接覆盖审核决策核心）。管理端前端（xingyu-admin）**无单测**（package.json 仅有 `test:audit` 数据审计脚本）。社区治理域（moderation/appeals/topic/galaxy 等）服务端行为基本零测试覆盖。

## 6. 有证据的 P0/P1 风险

| 级别 | 问题 | 证据 |
|---|---|---|
| P1 | admin API 无服务端角色校验（仅 checkLogin），角色只约束前端菜单 | SaTokenConfig.java:37；SysRoleService 仅用于 getInfo 返回 roles |
| P1 | 群聊治理决策按钮为虚假操作：后端无 decide 端点，前端误打 `/moderation/reports/{id}/decide` | AdminGroupController.java:13（仅 GET）；governance-status.vue:252 kind 判定缺 groups 分支 |
| P1 | community 域 admin 敏感操作零审计（@Log 使用数 0，对比 sys 域广泛使用） | grep 全 community/\*.java = 0 处；LogAspect.java 存在且 sys 控制器在用 |
| P1 | admin 免登录白名单包含文件预览/下载（`admin/files/**` 等） | SaTokenConfig.java:32-35 |
| P2 | `checkUserType` 对 userType 为空的 sys_user 放行 admin 登录 | PasswordLoginStrategy.java:139-142 |
| P2 | 举报/申诉 decision 枚举前后端逐值一致性未核验 | 列入下轮深查 |

## 7. 建议优先处理的前三个业务域

1. **审核与治理域（moderation/review/appeals + 群聊治理）**——业务最敏感、与用户端共享状态机、已有 Studio 轮测试基线可复用，且群聊治理虚假操作是用户可直接触发的功能缺陷。
2. **权限模型补强**——`/api/v1/admin/**` 增加服务端角色校验（Sa-Token checkRole 或拦截器统一角色断言），同步处理文件白名单与 userType 空值放行。
3. **社区用户与内容资产运营**——CommunityUserAdminService（封禁/恢复）与 ContentAsset 三态运营页，量大面广但契约简单，适合批量验证。

## 8. 第一业务域（审核与治理）最小审计与修复范围建议

- 后端：AdminGroupController 补群聊治理决策端点（或前端移除虚假按钮，先止血）；AdminModerationQueueController 的 decide 补 `@Log` 审计；decision 枚举与前端 UPHELD/DISMISSED/APPROVED/REJECTED 逐值核对。
- 前端：governance-status.vue 的 kind 判定补 groups 分支（或在后端补端点前隐藏 groups 决策按钮）。
- 测试：ModerationQueue decide 集成测试（reports/appeals 两态迁移 + 非管理员拒绝 + 审计落库断言），复用 Studio 轮 fixture 模式。
- 明确不做：不动 ReviewService 状态机（已封板）、不重构 sys 域、不扩权限系统架构。
