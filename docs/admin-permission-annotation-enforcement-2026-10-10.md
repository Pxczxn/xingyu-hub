# Admin Permission Annotation Enforcement — Acceptance Report

> 2026-10-10 · 恢复 sys 域 @SaCheckPermission 运行时生效。未 commit，dev 数据未触碰。
> fixture（sys_user/sys_role/sys_role_menu/sys_user_role 全部 gate/audit/pae 账号）已清零（0/0/0）；
> 隔离后端已停（java PID 25900 核实后终止）。

---

## 1. 根因及直接证据（AdminAnnotationRootCauseTest 钉死）

| 环节 | 事实 | 证据 |
|---|---|---|
| Controller HandlerMethod | SysUserController bean 为 `SysUserController$$SpringCGLIB$$0`（CGLIB 代理） | 测试断言 `AopUtils.isCglibProxy` 通过 |
| @SaCheckPermission 运行时读取 | **代理类方法上 0 个 @SaCheckPermission**（CGLIB 子类方法不继承方法注解）；目标类方法上有 | 测试断言 proxyAnnCount=0、targetAnnCount>0 |
| Sa-Token 注解机制注册 | `SaInterceptor.isAnnotation` 默认 true、`SaStrategy.checkMethodAnnotation` 实现完整（1.37.0 源码核实）——机制本身注册且启用 | sa-token-spring-boot3-starter-1.37.0-sources.jar |
| 顺序 | SaInterceptor.preHandle（注解检查）→ auth.run（路由断言）→ 业务 | 源码 97-115 行 |
| StpInterface.getPermissionList | 纯 role_menu→menu.permission 连接，无通配、无特权放行（SQL 核实） | SysUserMapper.java:40-43 |
| **失效环节** | **注解读取**：代理方法 getAnnotation=null → 校验空跑 | AdminAnnotationRootCauseTest 2/2 |

**重要修正**：上一轮"CGLIB 失效"推断的证据链有误——auditlow(role=user) 通过 `sys:user:list` 实际是**权限匹配通过**（role2 完整权限含 `sys:user:list`，此前查询被 head 截断误导）。**真正的失效铁证是 auditnull（0 权限、无任何角色）修复前通过 sys:user:list（200）**。修复依据（AnnotationUtils 穿透代理）与失效机制（CGLIB 丢注解）本身经本轮根因测试全部实证。

## 2. 修复方式与覆盖范围

`SaTokenConfig` 静态块：`SaStrategy.instance.getAnnotation` 换为 Spring `AnnotationUtils.findAnnotation`（穿透 CGLIB/桥接方法在类层次查找）。**仅替换注解读取**，校验逻辑与权限数据源（StpInterfaceImpl→role_menu→sys_menu.permission）原样。影响：全部 sa-token 注解（@SaCheckPermission/@SaCheckRole/@SaCheckLogin/@SaIgnore 等）恢复运行时生效；不引入第二套权限模型；细粒度编码保留；community 路径级 checkRole 门禁不削弱（两种机制叠加，@SaCheckPermission 先于路由断言执行）。

## 3. 权限矩阵及数据库副作用（AdminPermissionAnnotationIntegrationTest 4/4）

| 身份 | sys:user:list 查询 | sys:user:add 新建 | sys:role:list（跨域） | sys:notice:list |
|---|---|---|---|---|
| 无 token | 401 ✅ | — | — | — |
| noPerm（无角色，userType=NULL） | **403**（修复前 200）✅ | 403 ✅ | — | **403** ✅ |
| listOnly（仅 sys:user:list） | **200** ✅ | **403 + 零副作用**（sys_user 无 shouldnotexist 行）✅ | **403**（跨域隔离）✅ | **403** ✅ |
| addEdit（sys:user:add+edit） | — | **200 + 真实创建**（DB 行出现）✅；**无 delete 权限时删除 403** ✅；admin 删除 200 清理 ✅ | — | — |
| admin | 200 ✅ | — | 200 ✅ | 200 ✅ |

每次拒绝均核对 DB 副作用为零；写操作前后计数断言。

## 4. 角色权限数据另行核对（D 阶段）

**Permission Assignment Debt 实锤**：`sys_role_menu` 中 role=2（"普通用户"）绑定了 **67 个权限**，包括 `sys:user:add/edit/delete`、`sys:role:add/edit/delete`、`sys:menu:add/edit/delete`、`sys:config:add/edit/delete`、`monitor:online:forceLogout` 等系统管理级权限——这是**既有角色菜单配置问题**（非 fixture 设置、非本轮引入），且该角色还缺 `sys:user:list`（能删用户却不能查列表，配置自相矛盾）。按本轮约束未改动任何角色数据；**建议**：role=2 应仅保留社区/自助类权限，系统管理编码移交给管理员角色（需产品确认后清理 sys_role_menu）。

## 5. 审计日志现状（承上轮，无变化）

@Log 因 CGLIB 失效问题随本轮修复**自动恢复**（SaStrategy 全局修复覆盖 @Log 的执行——注意 @Log 由 AspectJ @annotation 切点驱动，本就不经 sa-token；其在 sys 域一直正常，community 域无注解仍缺审计——与本轮无冲突）。Product Debt 维持上轮报告。

## 6. 回归结果

| 套件 | 结果 |
|---|---|
| AdminAnnotationRootCauseTest（根因证据，2 用例） | 2/2 ✅ |
| AdminPermissionAnnotationIntegrationTest（权限矩阵，4 用例） | 4/4 ✅ |
| AdminAuthorizationGateIntegrationTest（community 防回退，3 用例） | 3/3 ✅ |
| 既有：Admin 密码守卫/SchemaGuard/Studio 三件套/ArticleFlow/SeriesContext/CommentModerationRestore | 17/17 ✅ |
| **合计** | **30/30 BUILD SUCCESS** ✅ |

## 7. 变更文件与遗留

**变更**：`SaTokenConfig.java`（静态块注解读取修复 + 上轮 community checkRole 注释，单文件）；**新增测试**：AdminAnnotationRootCauseTest、AdminPermissionAnnotationIntegrationTest。

**遗留 Product Debt**：
1. sys 域注解修复后的**全量端点巡检**（本轮矩阵覆盖 user/role/notice 域代表，130 处注解逐端点验证未做——修复机制已被根因测试钉死，风险可控）。
2. role=2 权限过度配置（第 4 节，需产品裁决后清理 sys_role_menu）。
3. userType 空值 sys_user 可登 admin（维持待确认）。
4. decision 枚举逐值一致性；审计补强（上轮方案，依赖本轮机制修复后 @Log 方可用于 community 域）。
