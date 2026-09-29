import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { accountApi } from "@/api/account/account.api";
import { authApi } from "@/api/auth/auth.api";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { checkNewEmail, emailChangeNotice } from "@/features/settings/account-security";
import { getStoredRecentAuth } from "@/features/settings/recent-auth";

/*
 * /settings/security/email (Phase 3H).
 *
 * Contract (verified against CommunityMeController:113 + CommunityAccountService:431):
 *   POST /api/v1/me/email/change  { newEmail, password }  + X-Recent-Auth
 *     -> { currentEmail, pendingEmail, mailPending }
 *
 * TWO THINGS THIS PAGE MUST NOT GET WRONG:
 *
 *  1. **The email does not change here.** The backend mails a confirmation link
 *     to the NEW address; only following that link activates it. So the success
 *     copy says "已发送确认邮件", never "邮箱已修改".
 *  2. **`mailPending: false` is a failure.** It means the mail could not be
 *     delivered, so the change will never complete. The notice is rendered as a
 *     warning and the current email is named as still valid.
 *
 * Requires a recent-auth grant. Without one the page sends the user to
 * /settings/security/re-authenticate with a returnTo back here — same flow as
 * Legacy, but the grant is now validated on read.
 */

type Me = { email: string; emailVerified: boolean };

export function SettingsEmailPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [meState, setMeState] = useState<"loading" | "error" | "ready">("loading");

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [hasGrant, setHasGrant] = useState(() => getStoredRecentAuth() !== null);

  useEffect(() => {
    let active = true;
    authApi
      .getMe()
      .then((data) => {
        if (!active) return;
        setMe({ email: data.email, emailVerified: data.emailVerified });
        setMeState("ready");
      })
      .catch(() => {
        if (active) setMeState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setNotice(null);

    const grant = getStoredRecentAuth();
    if (!grant) {
      setHasGrant(false);
      setSubmitError("身份验证已过期，请先重新验证身份。");
      return;
    }
    setHasGrant(true);

    const check = checkNewEmail(newEmail, me?.email ?? null);
    if (!check.ok) {
      setFieldError(check.message);
      return;
    }
    if (!password) {
      setFieldError("请输入当前密码。");
      return;
    }
    setFieldError(null);

    setBusy(true);
    try {
      const result = await accountApi.changeEmail(
        { newEmail: newEmail.trim(), password },
        grant.id,
      );
      // NOT "邮箱已修改" — the change is pending confirmation.
      setNotice(emailChangeNotice(result));
      setNewEmail("");
      setPassword("");
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.problem.detail : "更换失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (meState === "loading") return <PageState kind="loading" />;
  if (meState === "error") {
    return <PageState kind="error" title="无法读取账号信息" description="请确认登录状态后重试。" />;
  }

  return (
    <div className="section-gap">
      <section aria-labelledby="email-heading">
        <h2 id="email-heading" className="text-base font-semibold text-primary">
          修改邮箱
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="email-current">
          当前邮箱：{me?.email ?? "—"}
          {me && !me.emailVerified ? "（尚未验证）" : ""}
        </p>
      </section>

      {!hasGrant ? (
        <div
          className="rounded-lg border border-border bg-card p-4 text-sm"
          data-testid="email-need-reauth"
        >
          <p className="text-foreground">修改邮箱前需要先验证身份。</p>
          <Link
            to="/settings/security/re-authenticate?returnTo=/settings/security/email"
            className="mt-2 inline-block text-accent hover:underline"
          >
            去验证身份
          </Link>
        </div>
      ) : null}

      {submitError ? (
        <p role="alert" data-testid="email-error" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      {notice ? (
        <p
          role={notice.tone === "warning" ? "alert" : "status"}
          data-testid={`email-notice-${notice.tone}`}
          className={
            notice.tone === "warning"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {notice.message}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3" data-testid="email-form">
        <label className="flex flex-col gap-1 text-sm text-foreground">
          新邮箱
          <input
            type="email"
            value={newEmail}
            autoComplete="email"
            aria-invalid={fieldError ? true : undefined}
            onChange={(event) => {
              setNewEmail(event.target.value);
              setFieldError(null);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          当前密码
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldError(null);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {fieldError ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          提交后会向新邮箱发送确认邮件，完成确认后新邮箱才会生效。
        </p>
        <div>
          <Button type="submit" disabled={busy} data-testid="email-submit">
            {busy ? "提交中…" : "提交更换"}
          </Button>
        </div>
      </form>
    </div>
  );
}

