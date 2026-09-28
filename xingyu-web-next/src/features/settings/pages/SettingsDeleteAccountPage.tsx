import { useState } from "react";
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
 */

const CONFIRM_PHRASE = "停用账号";

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
      <div className="section-gap" data-testid="delete-account-done">
        <h2 className="text-base font-semibold text-primary">账号已停用</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          你的账号已停用，将无法继续登录。当前版本没有提供自助恢复入口，如需重新启用请联系管理员。
        </p>
      </div>
    );
  }

  const canConfirm = typed.trim() === CONFIRM_PHRASE && !busy;

  return (
    <div className="section-gap">
      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-base font-semibold text-primary">
          停用账号
        </h2>
      </section>

      <p role="alert" data-testid="delete-account-warning" className="text-sm text-destructive">
        {ACCOUNT_DEACTIVATION_WARNING}
      </p>

      <ul className="list-inside list-disc text-sm text-muted-foreground" data-testid="delete-account-facts">
        <li>停用后你无法登录，且当前页面无法撤销。</li>
        <li>你已发布的内容不会被自动删除。</li>
        <li>我们不会向你发送确认邮件，此操作立即生效。</li>
      </ul>

      {error ? (
        <p role="alert" data-testid="delete-account-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm) void onConfirm();
        }}
        className="flex flex-col gap-3"
        data-testid="delete-account-form"
      >
        <label className="flex flex-col gap-1 text-sm text-foreground">
          {`请输入「${CONFIRM_PHRASE}」以确认`}
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div>
          <Button
            type="submit"
            variant="destructive"
            disabled={!canConfirm}
            data-testid="delete-account-confirm"
          >
            {busy ? "处理中…" : ACCOUNT_DEACTIVATION_CONFIRM_LABEL}
          </Button>
        </div>
      </form>
    </div>
  );
}
