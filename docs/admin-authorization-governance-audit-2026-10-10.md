# Admin Authorization & Governance Contract Audit Report

> 2026-10-10 · 只审计 + 隔离 test 环境验证（7788）。未实施修复、未 commit。
> fixture（sys_user 99001/99002、社区用户）已清零，隔离后端已停（java PID 7552 核实后终止）。
> 本报告修正基线报告（admin-scope-contract-baseline-2026-10-10.md）中"无角色校验"的一刀切结论。

---

## 1. 管理端授权链路真实结构

```
请求 → SaTokenConfig（SaInterceptor，system 模块）
  ├─ /api/v1/admin/** 白名单外 → StpUtil.checkLogin()（仅登录态）
  │    ├─ sys 域 Controller（user/role/menu/dict/config/file/gen/notice/monitor…）
  │    │    └─ 130 处 @SaCheckRole/@SaCheckPermission ✅ 方法级授权存在
  │    └─ community 域 Controller（users/review/moderation/moderation-queue/topic/
  │         galaxy/featured/event/guide/announcement/group/content-asset）
  │         └─ 0 处 @SaCheck* 注解；Service 层无角色判断 → 仅登录即可调用
  └─ 白名单免登录：auth/login|register|captcha、crypto/**、config-group/public、
     sys/user/template、sys/file/preview|download、files/**（→ Phase D）
登录链：AdminAuthController → LoginStrategyFactory（clientType=ADMIN）
  → PasswordLoginStrategy.checkUserType（userType!="" 且 != "admin" 拒绝；空值放行）
  → LoginHelper.login → StpUtil.login(sys_user.id)
```

**基线报告修正**："admin API 无服务端角色校验"只在 **community 域**成立；sys 域有完整方法级注解授权（130 处）。风险边界精确化为：**社区业务治理接口（恰是业务敏感面）是授权真空区**。

## 2. 低权限账户权限矩阵与测试结果（隔离实测）

fixture：`auditlow`（sys_user，userType=admin，绑定 role_id=2"普通用户"）、`auditnull`（userType=NULL，无角色）、社区注册用户；对照组 admin。

| 探测 | 未登录 | 社区token | auditlow(role=user) | auditnull | admin |
|---|---|---|---|---|---|
| GET /community/users（列表） | 401 ✅ | 401 ✅ | **200** | **200** | 200 |
| GET /sys/role | 401 | 401 | 200/405(方法探测) | — | 405(同) |
| POST /review/{id}/decide | 401 | 401 | **到达业务层** | **到达业务层** | 同 |
| POST /moderation/reports/{id}/decide | 401 | 401 | **到达业务层** | — | 同 |
| POST /community/users/{id}/approve | 401 | 401 | **到达业务层** | — | — |

## 3. 已证实越权（安全 Blocker）与未验证风险

**Security Blocker（实证）**：低权限后台账号（role=user）对**真实待审 submission** 执行
`POST /api/v1/admin/review/{submissionId}/decide {decision:"APPROVED"}` → **200 成功**。
请求/响应/DB 副作用证据：
- 响应：`{"code":200,"data":{"decision":"APPROVED",...}}`
- `review_decision` 新行：`decided_by=99001(auditlow), comment='audit-lowpriv-probe'`
- `article.status: DRAFT → PUBLISHED`，`formal_revision` +1 —— **低权限账号完成了真实发布**
- 全链路无 403/401；`auditnull`（无任何角色）同样能到达 decide 业务层

**未验证风险（如实标注）**：
- user approve/reject/reset-password、moderation decision 等其余 community 写接口未做真实对象验证（探测到达业务层，推断同病，未实证）。
- decision 枚举逐值一致性仍未核验（UPHELD/DISMISSED 映射存在：ModerationService:639 REJECTED→DISMISSED）。

## 4. 群聊治理误路由的实际后果

- 数据源：`AdminGroupController.list` → `ConversationMapper.listGroupsForAdmin` = `SELECT * FROM conversation WHERE type='GROUP'`（仅只读）。
- 后端群聊治理写能力：**不存在**（ModerationMeasureExecutor 仅 HIDE/RESTORE_CONTENT 内容措施；无群聊措施、无 decide 端点）。
- 前端 /community/operations/groups 复用 governance-status.vue：加载 conversation 列表 → 按 reports 分支渲染"认定违规/驳回" → `submit()`（:252 `appeals ? appeals : reports`）把 **conversation UUID** 发往 `/moderation/reports/{conversationId}/decide`。
- **实际后果**：conversation UUID 在 report 表必然无对应行 → `NOT_FOUND`（"资源不存在"）→ 前端显示"处理失败"。**必失败**；ID 均为 UUIDv4，碰撞概率≈0，**不会误伤其他举报对象**。另列表列渲染（objectType/reporterId 等）对 conversation 行为 undefined，数据展示同样错位——整个 /groups 页面是数据+操作双重契约错位。
- **最小止血方案（建议）**：前端 /groups 路径隐藏决策按钮并以只读方式展示群组列表（复用现有列骨架），等待真正的群聊治理后端能力；不新增整套后端。

## 5. 关键操作审计覆盖与缺口（区分两类记录）

**业务处理记录（内容/状态自带）**：
- review_decision：`decided_by/decided_at/comment` ✅（含低权限越权者 ID——本次审计即靠它溯源）
- moderation_decision：`decided_by/comment/decided_at` ✅；appeal 表：`decided_by/decided_at` ✅
- **缺口 A**：`decideReportQueue`（ModerationService:645-650）在**无 moderation_case** 时直接 `report.setStatus("CLOSED")`——report 表**无 decided_by 字段**，该路径的关闭操作零可追溯证据。
- **缺口 B**：community 用户 approve/reject/reset-password（AdminCommunityUserController）无独立审批记录表，user 表无处理人字段。

**管理员安全审计日志（sys_oper_log）**：
- LogAspect（@Log 注解 AOP）机制健在且 sys 域广泛使用；**community 域 admin 控制器 0 注解** → 上述全部治理操作（含越权者执行的操作）**均不落 sys_oper_log**。
- 结论：两类记录互相独立——业务记录部分存在（review/moderation/appeal 决策有，无-case 举报关闭与用户审批无），安全审计日志 community 域整体缺失。**最小补强建议**：给 community 域 admin 控制器的写操作补 `@Log` 注解（复用现有 LogAspect，无新基建）；decideReportQueue 无-case 路径补 decided_by 落库（需 report 表加列或强制建 case——建议前者，最小）。

## 6. 文件白名单的真实边界（Phase D）

- `FileAccessController`（`/api/v1/admin/files/**`，SaTokenConfig 白名单免登录）：本地存储直出。
- **已收口部分**：`community/messages/` 前缀显式 403（2026-10-06 修复，私信附件只能经 membership 校验的消息接口获取）。
- **路径穿越**：`normalize() + startsWith(base)` 防护存在（:81），`..` 序列被归一化拦截。
- **仍开放**：头像、文章封面等其余上传类别无鉴权直出——代码注释自认"全项目既有状况"。这些类别本身是公开内容，风险为"已知路径枚举读取"而非私密泄露；未发现路径穿越或任意文件读取可行路径。
- 结论：白名单真实边界=**除私信附件外的全部本地上传文件**；无证据构成 P0，登记为既有债务（与基线报告一致）。

## 7. P0/P1 问题与最小修复顺序

| # | 级别 | 问题 | 最小修复 |
|---|---|---|---|
| 1 | **Security Blocker** | community 域 admin 接口仅 checkLogin，role=user 实证可批准发布 | 为 community 域 admin 控制器统一加 `@SaCheckRole("admin")`（或专用治理角色），一行/接口 |
| 2 | P1 业务契约 | 群聊治理决策按钮虚假操作（误路由必失败） | 前端 /groups 隐藏决策按钮 + 只读展示（后端能力就绪后再恢复） |
| 3 | P1 审计 | community 域治理操作零 sys_oper_log；无-case 举报关闭零追溯 | 写操作补 @Log；decideReportQueue 无-case 路径补处理人落库 |
| 4 | P2 | userType 空值 sys_user 可登 admin（实证） | 产品确认该兼容是否预期；若非预期，checkUserType 收紧空值 |
| 5 | P2 | decision 枚举逐值一致性未核验 | 下轮深查 |

**缺陷分类**：安全缺陷（#1）、业务契约缺陷（#2）、日志不足（#3）、产品兼容性问题（#4）——四类独立，不可互相替代修复。

## 附：验证现场

- 隔离后端 7788（test profile）已停止；fixture（sys_user 99001/99002、社区用户 auditc*/auditrev*、越权产生的 review_decision/formal_revision/article）已级联清零（复检 users=0/arts=0）。
- 临时脚本与 token 文件已删除；279 个历史 WIP 未触碰；未 commit。
