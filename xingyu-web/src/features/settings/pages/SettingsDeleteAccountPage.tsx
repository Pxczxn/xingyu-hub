import { useState } from "react";
import { AlertTriangle, MinusCircle } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_DEACTIVATION_CONFIRM_LABEL,
  ACCOUNT_DEACTIVATION_WARNING,
} from "@/features/settings/account-security";

/*
 * /settings/data/delete-account (Phase 3H).
 *
 * ⚠️ The honest description of this endpoint, which is why the page is careful:
 *
 *   `CommunityAccountService.requestAccountDeletion` (line 864) does exactly two
 *   things — `user.setStatus("SUSPENDED")` and `updateById`. There is:
 *     - no confirmation email,
 *     - no grace period,
 *     - no cancel endpoint,
 *     - no erasure job for the user's content.
 *
 *   So this is a **deactivation**, not a deletion, and it is effectively a
 *   one-way door from the UI. The page therefore:
 *     1. says 停用 (deactivate), never 永久删除,
 *     2. lists what actually happens (cannot log in; content is not removed),
 *     3. requires TYPING a confirmation phrase — a single click is too cheap for
 *        an irreversible action,
 *     4. tells the user there is no self-service way back.
 *
 * Rendering a "delete everything forever" button here would misrepresent the
 * backend and could cost someone their account on a misunderstanding.
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
  "你已发布的内容不会被自动删除。",
  "我们不会向你发送确认邮件，此操作立即生效。",
];

export function SettingsDeleteAccountPage() {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      await accountApi.requestAccountDeletion();
      setRequested(true);
    } catch (err) {
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

  const canConfirm = typed.trim() === CONFIRM_PHRASE && !busy;

  return (
    <div className="section-gap">
      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="section-heading">
          停用账号
        </h2>
      </section>

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
