# Authentication — Static Design Audit

日期：2026-10-08
范围：**只审计，不实施。** 覆盖登录、注册、邮箱验证、找回密码、重置密码、强制改密、
注册审核态、AuthLayout。
方法：后端认证契约 → 拦截器门禁 → 路由守卫 → 重定向 → 会话生命周期 → 表单校验 →
错误反馈 → 移动端布局，逐项在**真实运行的后端（`xingyu_hub_test`，独立端口 7861）**+
真实浏览器（chrome-devtools，1440 / 390）上实测；代码事实另行标注行号。
**未修改任何产品源码，未 commit，未做 Motion。**

实测过程中创建的所有临时账号、幂等记录、Redis 键、临时配置与后台进程，
已在结束时全部清理并逐项复核（见 §7）。

---

## 〇 结论先行

后端认证契约是**真实且有骨架的**：登录重试/锁定、反枚举、审核态、临时密码、
邮箱验证、密码重置吊销全量会话，全部有真实实现并通过实测。
前端路由守卫、`returnTo` 透传、强制改密自我守卫、错误态可恢复性也**实测通过**。

但存在**两个 correctness blocker**（均由实测证明可复现），以及若干视觉/一致性欠账：

| # | 类型 | 问题 | 可被真实用户触发 |
|---|---|---|---|
| **C-1** | correctness | `email/verify` 与 `password-reset` 在**缺少 token 字段**时返回 **500 INTERNAL_ERROR**（NPE），而非 400 `EMAIL_TOKEN_INVALID` | 否（前端有守卫），但契约错误 |
| **C-2** | correctness | 注册幂等的 **CONFLICT 语义未实现**：同一 `Idempotency-Key` + 不同载荷，返回**原注册响应**而非 409 | 是（真实客户端重复提交换了参数） |
| H-1 | hardening | `login` 为空时重试键塌缩为 `community:login:retry:`（空后缀），第 5 次失败后**锁死"空登录名"这一格** | 否（前端 `required`） |
| V-1 | visual | `AuthCard` 体系 7 个页面标题渲染为 **`<h3>`，页面无 `<h1>`**；`AuthStatusPanel` 体系渲染 `<h1>` — 同一认证流内标题层级不一致 | 是（a11y） |
| V-2 | visual | `VerifyEmailPage` 自建局部 `StatusPanel`，重复实现共享的 `AuthStatusPanel` | — |
| V-3 | visual | 重置密码失败时错误文本出现在提交按钮**下方**，与表单操作未做视觉绑定 | 是 |
| P-1 | product | **没有自助"修改密码"页**：仅有强制改密 + 邮件重置两条路径（`SettingsNav.tsx` 已注明后端无自助端点） | 是 |
| P-2 | product | 强制改密成功后**不吊销当前会话**（`adminResetPassword` 吊销，`forceChangePassword` 不吊销） | 是（语义选择） |
| T-1 | test/config | 前端测试夹具用 `8–32 + 四类复杂度`，运行中的 dev/test 后端实际为 `6–20、无复杂度` — **测试与真实配置不一致** | — |

---

## 一 后端认证契约（实测）

### 1.1 端点清单

`CommunityAuthController`（`@RequestMapping("/auth")`）：

| 端点 | 关键行为（实测） |
|---|---|
| `POST /auth/register` | 支持 `Idempotency-Key`；`needAudit=true` → `auditStatus:"PENDING"` |
| `POST /auth/sms/register` | 短信注册 |
| `GET /auth/captcha` | 图形验证码 |
| `POST /auth/login` | 返回 body `{token, mustChangePassword}` **且** 响应头 `satoken` |
| `POST /auth/logout` | 204 |
| `POST /auth/email/verify` | token 无效/过期/已用 → 400 `EMAIL_TOKEN_INVALID` |
| `POST /auth/email/resend` | 恒 `{acknowledged:true, mailPending:false}`（反枚举） |
| `POST /auth/password-recovery` | 恒 `acknowledged:true`；仅 ACTIVE 发链接 |
| `POST /auth/password-reset` | 校验密码策略 → 校验 token → **吊销全部会话** |
| `POST /auth/re-authenticate` | 敏感操作二次认证 |

`CommunityMeController`（`@RequestMapping("/me")`）：`GET /me`、`GET /me/sessions`、
`POST /me/email/change`、`POST /me/password/force-change`、`GET /me/account-status` 等。

### 1.2 登录语义（`CommunityAccountService.login:197-269`）

实测链路（全部在 7861 真实实例上）：

1. 验证码校验 → 重试上限检查（`checkCommunityRetryLimit:806-815`）
2. 查用户 → 密码不匹配则 `incrementCommunityRetry:822-829`（TTL = `lockTime` 分钟）
3. `PENDING_REVIEW` → 403「账号正在审核中，请等待管理员审核通过后再登录」✅ 实测
4. `REJECTED` → 403「注册申请未通过审核，如有疑问请联系管理员」
5. 其它非 ACTIVE → `ACCOUNT_SUSPENDED`
6. 需邮箱验证但未验证 → 403「请先完成邮箱验证后再登录」
7. `mustChangePassword` 且缺 `admin-temp-password` → 403「临时密码已过期，请联系管理员重新重置」✅ 实测
8. `singleLogin` → 吊销其它会话；`rememberMe` → 30 天，否则 1 天

**实测重试计数**（正确字段名 `login`）：

```
try1 → 邮箱或密码错误，还剩4次机会
try2 → 邮箱或密码错误，还剩3次机会
try3 → 邮箱或密码错误，还剩2次机会
try4 → 邮箱或密码错误，还剩1次机会
try5 → 账号已锁定，请29分钟后重试
```

计数逐次递减、锁定文案带真实 TTL 分钟 —— 与代码一致。

---

## 二 强制改密门禁（实测，用户点名项）

### 2.1 拦截器门禁（`CommunityAuthInterceptor`）

**实测**（真实管理员重置 → 临时密码登录 → 拿 token）：

| 请求 | 实测结果 |
|---|---|
| `GET /api/v1/me` | **200**（`isPasswordChangeAllowed` 显式放行） |
| `GET /api/v1/me/account-status` | **403**「请先修改密码后再继续使用社区功能」 |
| `POST /api/v1/moments` | **403** 同上 |
| `GET /api/v1/me/messages` | **403** 同上 |

门禁语义**完全符合设计**：只有 `GET /me` 与 `POST /me/password/force-change` 放行，
其余一律 403。

### 2.2 强制改密全流程（实测）

真实路径：`admin` 登录 → `POST /api/v1/admin/community/users/{id}/reset-password`
→ 拿到真实 `tempPassword` → 用临时密码登录。

| 步骤 | 实测结果 |
|---|---|
| 弱密码（`abc`）改密 | 400 `VALIDATION_FAILED`「password: 密码长度不能少于6位」 |
| 合法密码改密 | **204** |
| 改密后**同一 token** `GET /me` | **200**，`mustChangePassword` 变 `false` |
| 改密后受保护端点 | **200**（门禁解除） |
| 旧临时密码登录 | **401** |
| 新密码登录 | **200** |

**前端实测**：用临时密码在浏览器登录 → 自动跳 `/force-change-password`，
显示「这是一次强制修改…」横幅；保存后跳 `/`，首页正常加载、头部显示当前账号。

> 结论：强制改密链路**正确且可恢复**。

### 2.3 P-2：强制改密不吊销当前会话

`adminResetPassword:295-324` 会 `revokeActiveSessions`；
`forceChangePassword:326-337` **不吊销**。实测改密后旧 token 仍 200。
这是**语义选择**（改密者本人继续用），但与被改密的"新密码=旧会话失效"常规做法不同，
应作为产品决策登记。

---

## 三 注册审核态（实测）

### 3.1 配置开关是真实生效的

实测发现：`needAudit` **默认 false**（test 库），此时注册返回 `auditStatus:null` 且**可直接登录**。
将 test 库 `sys_config_group.register` 的 `needAudit` 置为 `true` 并重启后：

```
register → {"userId":"...","auditStatus":"PENDING","emailVerification":{"status":"NOT_REQUIRED"}}
login    → 403 {"code":"AUTH_FORBIDDEN","detail":"账号正在审核中，请等待管理员审核通过后再登录"}
```

**前端实测**：同密码登录 → `role="alert"` 精确显示后端原文，停留 `/login`，
提交按钮恢复可用（**可从错误态恢复**）✅

**管理员审核通过后**：`POST /api/v1/admin/community/users/{id}/approve` → 200，
随后同一账号登录 **200** ✅ —— 待审 → 通过 → 可登录全生命周期打通。

### 3.2 前端分流转发（`RegisterPage.tsx`）

- `auditStatus === "PENDING"` → `/register/pending-audit?registered=1`
- 邮箱未验证 → `/verify-email?...`
- 否则 → `/login?registered=1`

审核态页面（`PendingAuditPage`）三步时间线，明确写「重复提交不会加快审核」。

---

## 四 找回 / 重置密码（实测）

真实链路（`devResetLink` 在 mailPending 时返回，用于本机验证）：

| 步骤 | 实测结果 |
|---|---|
| `password-recovery`（未知邮箱） | 200 `{acknowledged:true, mailPending:false}`（**反枚举**） |
| `password-recovery`（真实 ACTIVE） | 200 + `devResetLink` |
| 重置前旧 token `GET /me` | **200** |
| `password-reset`（合法 token） | **200** `{"status":"RESET"}` |
| **重置后旧会话** | **401 `AUTH_REQUIRED`**（全量吊销 ✅，用户点名项） |
| token 重放 | 400 `EMAIL_TOKEN_INVALID` |
| 旧密码登录 | 401 |
| 新密码登录 | 200 |

---

## 五 失效 token / 邮箱链接（实测）

| 场景 | 实测结果 |
|---|---|
| `email/verify` token 乱码 | 400 `EMAIL_TOKEN_INVALID`「验证链接无效或已过期」 |
| `password-reset` token 乱码 | 400 `EMAIL_TOKEN_INVALID` |
| `email/resend` 未知邮箱 | 200 `{acknowledged:true, mailPending:false}`（反枚举） |
| **`email/verify` 缺 token 字段** | **500 `INTERNAL_ERROR`** ← **C-1** |
| **`password-reset` 缺 token 字段**（合规密码） | **500 `INTERNAL_ERROR`** ← **C-1** |

### C-1 根因（已定位到行）

`CommunityAccountService:396`（`verifyEmail`）与 `:488`（`resetPassword`）
直接调用 `TokenSupport.sha256(rawToken)`；而
`TokenSupport.sha256:31-38` 内 `value.getBytes(...)` **对 null 抛 NPE**，
被 `CommunityApiExceptionHandler` 的兜底分支映射成 500「系统繁忙，请稍后再试」。

**正确语义应为 400 `EMAIL_TOKEN_INVALID`** —— 同一方法的下一行就是 null 检查
（`token == null || ...`），说明作者预期 null 是"无效 token"，只是 **sha256 抢在检查前 NPE**。

**前端可达性**：`ResetPasswordPage` 在缺 token 时**本地短路**渲染「链接无效」，
不发请求；`VerifyEmailPage` 仅在 `?token=` 存在时才自动验证。
所以**浏览器路径触发不到**，但任何非浏览器客户端（脚本、旧版 App、直连 API）会拿到 500，
且污染错误监控。属**契约 blocker**，非用户可见 blocker。

---

## 六 幂等与重复提交（实测）

### 6.1 复现的语义（真实路径）

| 场景 | 实测结果 | 判定 |
|---|---|---|
| 新 `Idempotency-Key` + 新载荷 | 200，创建账号 | ✅ |
| 同 key + **同载荷** 重放 | 200，**body 完全一致（含同一 userId）** | ✅ 幂等正确 |
| 无 key 重复注册 | 400 `VALIDATION_FAILED`「username: 用户名已被占用」 | ✅ 映射正确（非 500） |
| 已有邮箱换用户名再注册 | 200，返回**原账号**响应 | ✅ 反枚举 |

### C-2：CONFLICT 分支未接线

| 场景 | 实测结果 | 应有行为 |
|---|---|---|
| 同 key + **不同载荷** | **200，返回原注册响应** | **409 `IDEMPOTENCY_CONFLICT`** |

**代码证据**：

- `CommunityAccountService:170` **写入** `record.setPayloadHash(TokenSupport.sha256(...))`
- `loadIdempotentRegisterResponse:181-195` **只做** `selectById` + Jackson 回放，
  **从不读取 `payloadHash`**
- `IdempotencyPolicy.resolve(existingHash, incomingHash, ...)` →
  `REPLAYED` / `CONFLICT` 已正确实现，**且有通过的单元测试**
  （`IdempotencyPolicyTest.java`），但**生产代码零引用**：
  `grep 'IdempotencyPolicy\.' --include=*.java | grep -v /test/` = 空集
- 对应错误码 `ErrorCode.IDEMPOTENCY_CONFLICT`（409）已定义、未使用

**影响**：客户端复用同一 key 但改了载荷时，会**静默**收到一个**属于另一个账号**的成功响应。
这是真实的正确性缺陷 —— 校验数据被写入却从不被读，等于该防护**从未生效**。

---

## 七 路由守卫 / returnTo / 会话生命周期（实测）

### 7.1 returnTo 端到端（实测，用户点名项）

```
/login?returnTo=%2Fstudio
  → 登录成功
  → /onboarding?returnTo=%2Fstudio   （onboarding 未完成，门禁生效）
  → 走完 欢迎/兴趣/关注/资料 四步
  → /studio                          （returnTo 完整保留 ✅）
```

### 7.2 开放重定向防护（代码 + 单测验证）

`sanitizeInAppPath`（`post-login-routing.ts:53-57`）要求 `raw.startsWith("/")` 且拒绝 `//`：

| 输入 | 输出 | 判定 |
|---|---|---|
| `/studio` | `/studio` | 保留 |
| `//evil.com` | `/` | 拒绝 ✅ |
| `https://evil.com` | `/` | 拒绝 ✅ |
| `javascript:alert(1)` | `/` | 拒绝 ✅ |
| `/evil.com` | `/evil.com` | 通过（React Router 视作应用内路径，**不构成开放重定向**） |

**结论：无开放重定向漏洞。**

### 7.3 会话生命周期

- `RequireAuth`（`guards.tsx`）：`initializing` 时显示「正在加载…」，
  未登录 → `Navigate to={"/login?returnTo=" + encodeURIComponent(pathname+search)}`
- `auth.store.ts`：`login` → `authApi.login` → `authApi.getMe` → `authenticated`
- 重置密码 → **全量吊销会话**（实测旧 token 401）
- 强制改密 → **不吊销**（§2.3 P-2）
- `apiRequest` 在 401 时清除本地 token

### 7.4 H-1：空 `login` 的重试键塌缩（实测，已降级）

契约字段是 **`login`**（非 `account`）。当 `login` 为空/缺失时
（`login:206`：`login == null ? "" : ...`），重试键变为 `community:login:retry:`（**空后缀**）。

实测：6 次空 `login` 失败 →
第 5 次起该键被锁 30 分钟，**但真实账号（不同键）完全不受影响**，
用正确密码登录其它账号仍然 200。

**判定：不是 DoS，不是枚举。** 仅"空登录名"这一格被锁。
根因是同名键共享；修法应是空 login 直接快速失败而非计数。

---

## 八 前端表单 / 错误反馈 / 移动端布局（实测）

### 8.1 表单与交互

- 登录表单 `login` 输入框 `required` → 浏览器拦截空提交（**H-1 前端不可达**）
- 重复提交防护：提交中显示「登录中…」且 `disabled` ✅
- 错误反馈：`role="alert"` + `aria-live="assertive"`，精确显示后端原文，提交后恢复可用 ✅
- 密码规则：`password-rules.ts` 前端预校验

### 8.2 移动端 390 布局（实测全部 6 个认证屏）

| 路径 | 溢出 | 表单宽 | 标题层级 |
|---|---|---|---|
| `/login` | 无 | 327 | `<h3>` (V-1) |
| `/register` | 无 | 278 | `<h1>` ✅ |
| `/verify-email` | 无 | — | `<h1>` ✅ |
| `/forgot-password` | 无 | 278 | `<h3>` (V-1) |
| `/reset-password`（无 token） | 无 | — | `<h1>` ✅ |
| `/reset-password`（有 token） | 无 | — | `<h3>` (V-1) |
| `/register/pending-audit` | 无 | — | `<h1>` ✅ |

**六屏全部无横向溢出**；输入框高度统一 40px。移动端布局无 blocker。

### 8.3 V-1：标题层级不一致（实测 a11y 树）

- `AuthCard.tsx` 的 `CardTitle` 渲染为 **`<h3>`** →
  `登录星语` / `找回密码` / `设置新密码` 等页面**整页没有 `<h1>`**
- `AuthStatusPanel.tsx` 渲染 `<h1>`（含 12 行注释解释刻意的 20px 字号）
- 结果：**同一个认证流，有的页面有 h1、有的没有**，且 `/reset-password`
  **依 token 有无在 h1/h3 间切换**。

### 8.4 V-3：重置失败错误位置

`/reset-password?token=garbage` 提交后：`role="alert"` 的「验证链接无效或已过期」
渲染在**提交按钮下方**，表单仍保持填写状态，错误与操作的视觉关联弱。

### 8.5 console 检查

认证页仅 2 条：登录前会话探测的 **401**（预期）+ 一条 WebSocket close 警告
（已知的"一 tab 一 socket"行为）。**无页面级报错。**

---

## 九 其它登记

- **V-2**：`VerifyEmailPage.tsx` 自建局部 `StatusPanel`，与共享 `AuthStatusPanel`
  近乎重复 —— 应合并。
- **P-1**：无自助改密页。`SettingsNav.tsx` 注释明确：
  「修改密码 backend has NO self-service set-password endpoint. Only `/me/password/force-change`」
- **T-1**：前端测试夹具 8–32 + 四类复杂度；运行后端实际 6–20、无复杂度。**两者不一致。**
- SMTP 在 test 环境未配置 → `mailPending:true, mailError:"Authentication failed"`，
  接口**如实上报**（不伪造成功），属正确的降级行为。

---

## 十 待用户裁决的实施范围

按用户指令「先只审计，不实施…完成后提交审计结论，由我决定实施范围」，
以下按**建议优先级**列出，等待裁决：

1. **C-1**（`email/verify` / `password-reset` 缺 token 的 500→400）：
   改动极小（两处 null 守卫），语义明确。
2. **C-2**（幂等 CONFLICT 接线）：需决定是否接入 `IdempotencyPolicy`，
   并补冲突测试；涉及注册契约语义。
3. **H-1**（空 login 重试键）：一行守卫。
4. **V-1**（`AuthCard` 标题 h3→h1）：可能波及 7 个页面版式，需视觉确认。
5. **V-2 / V-3**：局部整理。
6. **P-1 / P-2 / T-1**：属产品决策，非缺陷。

**本次审计不改任何认证功能，不擅自扩张。**
