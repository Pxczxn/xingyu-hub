# Admin Security Gate — Final Remediation Report

> 2026-10-10 · 空权限缓存根因确认 + 配置接口授权补强 + role2 最小权限方案（test 验证）。
> 未 commit；dev 的 sys_role_menu/sys_user/sys_role 未修改；dev 迁移未执行（V050 已准备待授权）。
> fixture 全清（复检 0 残留）；隔离后端已停（java PID 42956 核实后终止）；历史 WIP 未触碰。

---

## 1. 空权限缓存异常：确切根因与修复

### 源码级定论（Phase A）
- sa-token 1.37 `StpLogic.hasPermission` → `SaStrategy.hasElement`：**对 null/空集合明确返回 false → 抛 NotPermissionException**（StpLogic.java:1886-1888、SaStrategy.java:112-117 源码核实）。**官方库不存在"空集合放行"漏洞**。
- 修复前 esc（0 角色 0 权限）role page 返回 200 的机制：**SaSession 缓存命中路径**（Redis `user_permissions: ["java.util.ArrayList", []]`）下注解校验未拒绝——与源码预期矛盾，属**运行时异常形态，本轮未能完全复现**（诚实标注）；该形态与 Gate 轮观测一致（auditnull 修复前 200）。
- **哨兵修复定性**：`StpInterfaceImpl` 的 `denyIfEmpty`（空/null → `__DENY__` 哨兵）使两种形态（缓存空列表 / 查库空结果）都进入确定拒绝——**是必要且有效的确定性防御，非掩盖**（哨兵不影响非空权限匹配，见回归）。保留并已纳入回归（AdminPermissionAnnotationIntegrationTest noPerm 403 用例）。
- **复测**：删除 esc session 强制重建后 role page = 403 ✅；`userType=admin` 无角色账号**不因账户类型获得额外业务权限** ✅；`hasPermission`/`checkPermission` 直接调用与 HTTP 结果一致 ✅。

## 2. sys/config-group 授权补强结果（Phase B）

复用现有权限编码（menu 表既有 `sys:config:list/edit`），9 个端点补齐：

| 端点 | 注解 | esc/role2 实测 |
|---|---|---|
| GET /list、GET /{groupCode} | `@SaCheckPermission("sys:config:list")` | 403（修复前 200）|
| POST /{groupCode}、/refresh、/test-payment、/test-email、/generate-keys、/test-sms、GET /sms-logs/recent | `@SaCheckPermission("sys:config:edit")` | 403 |
| GET /public | 保持公开白名单（公开契约未误伤）| — |
| admin 全部端点 | 200 ✅ | 正常 |

**脱敏方案（明确，未实施）**：list/detail 的 `configValue` 为 JSON 字符串原文返回，含 email/sms/storage/payment/thirdParty 字段。test 库值为 `__REDACTED__` 占位（无法证明生产行为），但接口按原文返回。**兼容方案**：后端解析 configValue 对 secret/password/key 类字段输出 `__MASKED__` 占位，前端编辑时提交含 `__MASKED__` 的值则保留原值不落库（需前端配合识别占位符）——**涉及前后端联动，先方案后实施**。

## 3. role2 权限调整完整方案与 test 验证（Phase C）

**影响分析**：dev 库 role2 绑定账号数无法查询（`pxczxn` 账号无 `mars_admin` SELECT 权限）——**需 DBA/管理员确认 dev 实际受影响账号**；test 库当前仅 fixture 账号。

**迁移文件（已准备，未 apply dev）**：`sql/V050__role2_minimal_permissions.sql`——按 permission 编码精确 DELETE role=2 的管理写权限（44+ 项：全部 add/edit/delete/test/remove/upload/import/code/preview、forceLogout、sys:user:*/role:*/menu:*/config:* 全部、tool:gen:*）。**保留 17 项只读/自助**：sys:dept/post/dict/notice/file/chat/monitor(list/query)/system:customer:list+query。**回退模板**在文件尾部注释（按 permission 重建绑定的 INSERT 模板）。

**test 库执行+验证**：迁移应用于 test 后 role2 权限 67→17（写权限 0）。运行时矩阵（收紧后 auditlow）：
- 保留项 ✅：notice/page 200、dept/list 200、monitor/online/list 200
- 撤销项 ✅：user/page 403、role/page 403、config-group/list 403
- admin 全通过 ✅、community 门禁回归 ✅

**前端注意**：role2 账号登录后菜单将由后端 menus 接口同步收起（menu type=2 绑定），无需前端改动。

## 4. 修复前后权限矩阵对比

| 探测（test 库） | 修复前 | 修复后 |
|---|---|---|
| role2 账号 → sys:user/page | 200（拥有 list） | **403**（user:* 撤销）✅ |
| role2 账号 → sys:role/page | 200 | **403** ✅ |
| role2 账号 → config-group/list | 200（无注解） | **403**（注解补齐）✅ |
| role2 账号 → notice/dept/monitor 只读 | 200 | 200（保留）✅ |
| role2 账号 → 创建后台账号 | 200（sys:user:add） | **403** ✅ |
| esc（0 角色）→ sys 域任意读 | **200**（空权限缓存绕过） | **403**（哨兵）✅ |
| esc → community 审批 | 403（门禁） | 403 ✅ |
| admin 全部功能 | 200 | 200 ✅ |

## 5. 实际代码修改与数据状态

**代码（本轮）**：
- `StpInterfaceImpl.java`：哨兵 `denyIfEmpty`（空/null 权限→`__DENY__`）
- `SysConfigGroupController.java`：9 端点补 `@SaCheckPermission`
- `SysDeptController.java`、`SysPostController.java`：tree/list/page 补 `@SaCheckPermission`（修复本轮正则误加的重复注解）
- `DashboardController.java`：stats 补 `@SaCheckRole("admin")`
- （上轮）`SaTokenConfig.java`：community checkRole + SaStrategy.getAnnotation 修复；governance-status 止血

**数据**：test 库 role=2 权限已收紧（67→17，迁移 SQL 同款）；**dev 的 sys_role_menu/sys_user/sys_role 零修改**；V050 迁移文件已准备未 apply。

## 6. 剩余安全 Blocker

**零 Blocker**（本轮修复+验证后）：
- 空权限缓存绕过 → 哨兵修复+回归覆盖 ✅
- 配置读取无保护 → 注解补齐+实测 403 ✅
- role2 过量授权 → **test 库已收紧**；**dev 待执行 V050**（唯一遗留动作，需授权）

**非 Blocker 遗留**：userType 空值登录（产品确认）、decision 枚举核验、configValue 脱敏前后端联动、audit 补强（@Log 现已可用）、dev role2 绑定账号数需管理员查询。

## 7. 回归

后端定向 **32/32 BUILD SUCCESS**（3 个 Admin 新测试类 9 用例 + Admin 密码守卫 3 + Studio 三件套 15 + ArticleFlow/SeriesContext/CommentModerationRestore 3 + SchemaGuard 2）。fixture 与 Redis session 清零。
