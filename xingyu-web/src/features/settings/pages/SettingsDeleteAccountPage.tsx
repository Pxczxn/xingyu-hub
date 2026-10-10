import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MinusCircle, ShieldAlert } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_DEACTIVATION_CONFIRM_LABEL,
  ACCOUNT_DEACTIVATION_WARNING,
} from "@/features/settings/account-security";
import { getStoredRecentAuth, clearStoredRecentAuth } from "@/features/settings/recent-auth";
import { setStoredToken } from "@/lib/storage";

/*
 * /settings/data/delete-account (Phase 3H).
 *
 * ⚠️ The honest description of this endpoint, which is why the page is careful:
 *
 *   `CommunityAccountService.requestAccountDeletion` does exactly ONE thing —
 *   `user.setStatus("SUSPENDED")` and `updateById`. There is:
 *     - no confirmation email,
 *     - no grace period,
 *     - no cancel endpoint,
 *     - no erasure or anonymisation of the user's content, anywhere.
 *
 *   So this is a **deactivation**, not a deletion, and it is effectively a
 *   one-way door from the UI. The page therefore:
 *     1. says 停用 (deactivate), never 永久删除,
 *     2. lists what actually happens (cannot log in; content is NOT removed),
 *     3. requires TYPING a confirmation phrase — a single click is too cheap for
 *        an irreversible action,
 *     4. tells the user there is no self-service way back.
 *
 * Rendering a "delete everything forever" button here would misrepresent the
 * backend and could cost someone their account on a misunderstanding.
 *
 * --- 2026-10-08 (Settings Contract Recovery, B2) ---------------------------
 * The endpoint now demands a FRESH, SINGLE-USE re-auth grant
 * (`X-Recent-Auth`). Before this round any logged-in session could POST the
 * deactivation with no proof of identity at all — one stolen/CSRF'd session was
 * enough to permanently deactivate someone's account.
 *
 * Two consequences this page has to handle honestly:
 *
 *  1. The user may arrive with no grant (or an expired one). Rather than
 *     failing at submit time with a bare 403, the page shows the
 *     "需要先验证身份" state up front and links to the re-auth page with a
 *     returnTo back here — same flow the email page already uses.
 *  2. The grant is **consumed** by the call, so it cannot be reused. After a
 *     failure the stored grant is cleared and `hasGrant` goes false, which is
 *     accurate: whatever the server said about the reason, that grant is gone.
 *
 * The three FACTS below were re-verified against the code this round, and item
 * 2 is new: deactivation also kills every device's session and every issued
 * API Token. It reads as "more thorough" to the user, but the real reason the
 * code checks is that it needs no second source of truth — account status is
 * authoritative on its own.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * The danger used to be typeset exactly like every harmless setting: a section
 * heading, one red line of text, a bullet list, a form. Nothing about the page
 * said "stop and read this" — the only signal was the colour of one paragraph.
 *
 * It is now a single CONTAINED DANGER PANEL: destructive border and wash, a
 * warning band with an icon at the top, the consequences as a divided list, and
 * the typed confirmation living INSIDE the same panel as the last step. The
 * panel is the only thing on the page, so there is no neighbouring control to
 * mistake for a safe alternative.
 *
 * This is the one settings page that should NOT look like the other eight. That
 * is the point.
 * ---------------------------------------------------------------------------
 */

const CONFIRM_PHRASE = "停用账号";

const FACTS = [
  "停用后你无法登录，且当前页面无法撤销。",
  "你已发布的内容不会被自动删除，也不会被匿名化。",
  "所有设备上的登录状态与已创建的 API Token 会一并失效。",
  "我们不会向你发送确认邮件，此操作立即生效。",
];

export function SettingsDeleteAccountPage() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [hasGrant, setHasGrant] = useState(() => getStoredRecentAuth() !== null);

  async function onConfirm() {
    const grant = getStoredRecentAuth();
    if (!grant) {
      setHasGrant(false);
      setError("身份验证已过期，请先重新验证身份。");
      return;
    }
    setHasGrant(true);
    setBusy(true);
    setError(null);
    try {
      await accountApi.requestAccountDeletion(grant.id);
      // 停用后会话已失效（服务端在鉴权时按账号状态拒绝），留着本地 token 只会让
      // 下一个请求拿到 401，看起来像"页面坏了"。清掉并广播，守卫会带用户回登录页。
      setStoredToken(null);
      clearStoredRecentAuth();
      setRequested(true);
    } catch (err) {
      // 服务端在停用成功时才会消费 grant，但失败原因不止一种（网络错误时 grant
      // 其实还可用）。所以这里**不能**假设 grant 已死，也不能留着它不管 ——
      // 保守做法是清掉并要求重新验证：代价是多输一次密码，代价的代价是
      // 一个可能已被消费掉的凭证被反复重放。宁可多一次验证，不可少一次防重放。
      clearStoredRecentAuth();
      setHasGrant(false);
      setError(err instanceof ApiError ? err.problem.detail : "操作失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (requested) {
    return (
      <div className="section-gap">
        <div
          className="rounded-xl border border-border/70 bg-card p-6 text-center"
          data-testid="delete-account-done"
        >
          <span
            className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-sunken text-muted-foreground"
            aria-hidden
          >
            <MinusCircle className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-card font-semibold text-primary">账号已停用</h2>
          <p className="mx-auto mt-1.5 max-w-md text-meta text-muted-foreground">
            你的账号已停用，将无法继续登录。当前版本没有提供自助恢复入口，如需重新启用请联系管理员。
          </p>
        </div>
      </div>
    );
  }

  const canConfirm = typed.trim() === CONFIRM_PHRASE && !busy && hasGrant;

  return (
    <div className="section-gap">
      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="section-heading">
          停用账号
        </h2>
      </section>

      {!hasGrant ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-sunken/50 p-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid="delete-account-need-reauth"
        >
          <p className="flex items-center gap-2 text-meta text-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            停用账号前需要先用当前密码验证身份。
          </p>
          <Link
            to="/settings/security/re-authenticate?returnTo=/settings/data/delete-account"
            className="focus-ring w-fit shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            去验证身份
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/[0.03]">
        <div className="flex items-start gap-3 border-b border-destructive/20 px-4 py-4">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <p
            role="alert"
            data-testid="delete-account-warning"
            className="text-card font-medium leading-6 text-destructive"
          >
            {ACCOUNT_DEACTIVATION_WARNING}
          </p>
        </div>

        <ul
          className="list-none divide-y divide-destructive/10 p-0"
          data-testid="delete-account-facts"
        >
          {FACTS.map((fact) => (
            <li key={fact} className="px-4 py-3 text-meta text-muted-foreground">
              {fact}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfirm) void onConfirm();
          }}
          className="flex flex-col gap-3 border-t border-destructive/20 bg-destructive/[0.04] px-4 py-4 sm:flex-row sm:items-end"
          data-testid="delete-account-form"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-meta text-foreground-soft">
            请输入「{CONFIRM_PHRASE}」以确认
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="focus-ring h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <Button
            type="submit"
            variant="destructive"
            disabled={!canConfirm}
            data-testid="delete-account-confirm"
            className="shrink-0"
          >
            {busy ? "处理中…" : ACCOUNT_DEACTIVATION_CONFIRM_LABEL}
          </Button>
        </form>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid="delete-account-error"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
