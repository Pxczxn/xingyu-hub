# Admin Security Gate Recovery — Acceptance Report

> 2026-10-10 · 安全授权修复 + 群聊治理止血 + 隔离反证。未 commit，dev 数据未触碰。
> fixture 全部清理（复检 sys_user/community_user/article 残留 = 0/0/0），隔离后端已停（java PID 9932 核实后终止）。

---

## 1. 授权链路真实结构（修复前勘误与根因）

**对上一份审计报告的重要修正**：`@SaCheckPermission` 在整个 admin-api **运行时不生效**——不只 community 域。

根因链（三层证据）：
1. **实测**：auditlow（role=user，权限集不含 `sys:user:list`）通过 `@SaCheckPermission("sys:user:list")` 保护的 `GET /admin/sys/user/page`（200 + 数据）→ 注解未执行。
2. **机制**：admin 控制器被项目 AOP 切面（LogAspect `@annotation` / RepeatSubmitAspect）CGLIB 代理；sa-token 1.37 的注解鉴权从 `HandlerMethod.getMethod()`（**代理类方法**）读取注解，CGLIB 子类方法**不继承方法注解** → `getAnnotation` 返回 null → 校验静默跳过（SaInterceptor.isAnnotation 默认 true、SaStrategy 实现完整，均经源码核实）。
3. **推论**：130 处 sys 域注解同样是摆设——**此前整个 admin-api 的实际授权 = 仅 checkLogin**。基线报告"community 域授权真空"方向正确但范围低估。

## 2. 修复内容（最小必要，复用现有体系）

**`SaTokenConfig.java`**（唯一后端改动，xingyu-system 模块）：在既有 SaInterceptor 的 auth 函数内，对社区治理域路径统一追加运行时 `StpUtil.checkRole("admin")`：

```
/api/v1/admin/community/**  /review/**  /moderation/**  /topics/**  /operations/**
```

- **不依赖注解读取**，免疫 CGLIB 丢注解问题；复用现有 `sys_role`（code=admin）与 StpInterfaceImpl（role codes 来自数据库，SaSession 缓存）。
- **覆盖核对**：community 包全部 14 个 Controller 的 @RequestMapping（/community/users|events|featured|galaxies|guide-pages|search-index、/moderation、/review、/topics、/operations/**）完全落入 5 组模式；**/sys/**、/monitor/**、/log/**、/file/**、/tool/** 不匹配，未误伤**（实测 sys 域与 monitor 对 auditlow 行为与修复前一致——保持原状）。
- 执行顺序：checkLogin（401）→ checkRole（403）→ 业务。拒绝先于任何业务修改。
- 运行时路由断言是**止血性统一拦截**；sys 域注解失效是**独立大问题**（130 处注解全部无效），不在本轮修复范围——已登记，待裁决（方案候选：修 sa-token 注解读取策略取 target class、或全部迁移路由断言）。

## 3. 权限矩阵：修复前 vs 修复后（隔离实测）

| 探测 | 修复前 | 修复后 |
|---|---|---|
| 未登录 → 审核队列/decide | 401 | 401（body.code）✅ |
| 社区 token → 同上 | 401 | 401 ✅（隔离未破坏） |
| auditlow(role=user) → 审核读取 | **200** | **403 没有角色权限** ✅ |
| auditlow → **真实 submission decide APPROVED** | **200 + 真实发布** | **403** ✅ |
| auditlow → 举报 decide / 用户 approve / 申诉读取 | 到达业务层 | 403 ✅ |
| auditnull(userType=NULL, 无角色) → decide | 到达业务层 | 403 ✅ |
| 合法 admin → 审核读取/decide | 200 | 200 ✅（功能未封死） |
| auditlow → sys:user/page、monitor（未修复区） | 200 | 200（原状，未误伤） |

## 4. 真实 SQL 副作用对比（同一漏洞复测路径）

- **修复前**（审计轮）：低权限 decide → `review_decision` 新行（decided_by=99001, comment='audit-lowpriv-probe'）、article DRAFT→**PUBLISHED**、formal_revision +1。
- **修复后**（反证轮）：低权限 decide → **403**，`review_decision` before=after=**0**（无新增行）、article 保持 **IN_REVIEW**、formal_revision before=after（submit 时的送审快照为业务行为，未新增）。**拒绝发生在业务修改之前，副作用为零**。
- 随后合法 admin decide 同一 submission → 200，`review_decision.decided_by=1(admin)`，article → PUBLISHED——正常功能完好。

## 5. 群聊治理止血（Phase C）

- 抽离纯函数 `governance-status.logic.mjs`：`queueKind/canDecide/queueEndpoint/decideEndpoint`。
- `governance-status.vue`：/groups 路径**不再渲染"认定违规/驳回"按钮**（只读），`submit()` 增加 `canDecide` 守卫——conversation ID 不会再发往 reports decide。
- reports/appeals 端点与决策按钮**原样保留**（回归钉死）。
- 未新增群聊 decide 后端、未改群聊业务状态机 ✅。

## 6. 审计现状与最小补强方案（Phase D，未实施）

- LogAspect 行为核实：@Log 注解驱动，记录操作人/URL/IP/方法/请求参数/响应（2000 截断）/异常/耗时，异步落 sys_oper_log。**请求参数无敏感字段脱敏**（password 等会随 body 进日志）——补强时须一并处理。
- 业务处理记录：review_decision、moderation_decision、appeal 均有 decided_by/comment/decided_at ✅。
- 真实缺口：① **decideReportQueue 无 moderation_case 路径**直接 `report.setStatus("CLOSED")`，report 表无处理人字段 → 零追溯；② community 用户 approve/reject/reset-password 无独立审批记录；③ community 域全部治理操作不落 sys_oper_log（且直接补 @Log 无效——注解已被 CGLIB 失效，见第 1 节！需先修注解机制或改用拦截器审计）。
- **最小补强方案（建议，待授权）**：修复 CGLIB 注解丢失（SaStrategy.getAnnotation 策略改为解析 target class，或 HandlerMethod 层面取 UserTarget）→ 修复后 community 域补 @Log 才有效；@Log 落库前对 password/token 字段脱敏；report 无-case 路径补处理人落库（report 表加 decided_by/decided_at 两列，需迁移）。

## 7. 回归结果

| 套件 | 结果 |
|---|---|
| **AdminAuthorizationGateIntegrationTest（新增，3 用例：授权矩阵/零副作用/管理员放行）** | **3/3** ✅ |
| 后端全量定向（gate + Admin 密码守卫 + SchemaGuard + Studio 三件套 + ArticleFlow + SeriesContext + CommentModerationRestore） | **26/26** ✅ |
| xingyu-admin governance-status.logic node:test（新增 5 用例） | 5/5 ✅ |
| xingyu-admin `npm run build` | 成功 ✅ |
| 测试排障记录：管理端错误契约=HTTP 200 + body.code（断言用 $.code 非 HTTP status）；submit 即冻结 formal_revision（业务行为，断言改 before/after）；JUnit 方法顺序→PER_CLASS + @Order 显式序列 | — |

## 8. 变更文件范围（未 commit）

- `xingyu-server/xingyu-core/xingyu-system/.../config/SaTokenConfig.java`（修改：community 治理域 checkRole）
- `xingyu-admin/src/views/community/governance-status.vue`（修改：groups 只读 + canDecide 守卫）
- `xingyu-admin/src/views/community/governance-status.logic.mjs`（新增）
- `xingyu-admin/tests/governance-status.logic.test.mjs`（新增）
- `xingyu-server/xingyu-starter/src/test/.../AdminAuthorizationGateIntegrationTest.java`（新增）

## 9. 未处理债务（等待授权）

1. **sys 域 130 处 @SaCheckPermission 因 CGLIB 失效**——比 community 域更大的暴露面（sys:user 删除、config 修改等），本轮未修。
2. 审计补强（见第 6 节方案，需注解机制修复 + report 表迁移）。
3. userType 空值 sys_user 可登 admin（实证，产品确认中）。
4. decision 枚举逐值一致性核验。
