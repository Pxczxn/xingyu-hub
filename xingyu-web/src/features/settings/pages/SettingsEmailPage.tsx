import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, Mail, ShieldAlert } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { authApi } from "@/api/auth/auth.api";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";
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
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * Same skeleton as every other settings page: heading, then a full-width form
 * with two fields and a submit. But the form is not what people come here for —
 * the overwhelming majority of visits are "which address is on my account?".
 * Leading with an input answers the wrong question first.
 *
 * New shape: a CURRENT-VALUE CARD (the address, set large, with its verification
 * state) followed by a COLLAPSED change panel. The panel is toggled, not
 * conditionally rendered — the form stays mounted so its own tests can still
 * submit it directly, and so no field state is lost when the panel is closed.
 * ---------------------------------------------------------------------------
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
  const [formOpen, setFormOpen] = useState(false);

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
      setSubmitError(error instanceof ApiError ? error.problem.detail : "更换失败，请稍后重试。");
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
        <h2 id="email-heading" className="section-heading">
          修改邮箱
        </h2>
        <p className="lede mt-1.5 max-w-2xl">
          邮箱用于登录、找回密码与接收通知。更换后需要在新邮箱完成确认才会生效。
        </p>
      </section>

      {/* Current value first — this is the question most visits are actually asking. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-muted-foreground"
            aria-hidden
          >
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            {/* The verification state stays INSIDE `email-current` rather than
                living only in the badge beside it: this element is what a screen
                reader reads out as the current address, and "is it verified?" is
                part of that answer. The badge is the visual echo.
                No separate "当前邮箱" label above — the value line already opens
                with it, and saying it twice was pure redundancy. */}
            <p className="truncate text-card font-medium text-primary" data-testid="email-current">
              当前邮箱：{me?.email ?? "—"}
              {me && !me.emailVerified ? "（尚未验证）" : ""}
            </p>
          </div>
        </div>

        <span className="flex shrink-0 items-center gap-2">
          {me && me.emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-meta font-medium text-accent-strong">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              已验证
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-meta font-medium text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              待验证
            </span>
          )}
        </span>
      </div>

      {!hasGrant ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-sunken/50 p-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid="email-need-reauth"
        >
          <p className="text-meta text-foreground">修改邮箱前需要先验证身份。</p>
          <Link
            to="/settings/security/re-authenticate?returnTo=/settings/security/email"
            className="focus-ring w-fit shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            去验证身份
          </Link>
        </div>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          data-testid="email-error"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
        >
          {submitError}
        </p>
      ) : null}

      {notice ? (
        <p
          role={notice.tone === "warning" ? "alert" : "status"}
          data-testid={`email-notice-${notice.tone}`}
          className={cn(
            "rounded-lg border px-4 py-2.5 text-meta",
            notice.tone === "warning"
              ? "border-destructive/25 bg-destructive/5 text-destructive"
              : "border-accent-line/60 bg-accent-soft text-accent-strong",
          )}
        >
          {notice.message}
        </p>
      ) : null}

      {/* The change panel. Toggled, never unmounted — see the header note. */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <button
          type="button"
          aria-expanded={formOpen}
          aria-controls="email-change-form"
          onClick={() => setFormOpen((open) => !open)}
          className="focus-ring flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken/50"
        >
          <span className="text-card font-medium text-primary">更换为新的邮箱</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              formOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        <form
          id="email-change-form"
          onSubmit={onSubmit}
          className={cn("flex flex-col gap-3 border-t border-border/70 p-4", !formOpen && "hidden")}
          data-testid="email-form"
        >
          <label className="flex flex-col gap-1.5 text-meta text-foreground-soft">
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
              className="focus-ring h-9 rounded-md border border-input bg-surface-sunken/60 px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-meta text-foreground-soft">
            当前密码
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldError(null);
              }}
              className="focus-ring h-9 rounded-md border border-input bg-surface-sunken/60 px-3 text-sm text-foreground"
            />
          </label>
          {fieldError ? (
            <p role="alert" className="text-meta text-destructive">
              {fieldError}
            </p>
          ) : null}
          <p className="text-meta text-muted-foreground">
            提交后会向新邮箱发送确认邮件，完成确认后新邮箱才会生效。
          </p>
          <div>
            <Button type="submit" disabled={busy} data-testid="email-submit">
              {busy ? "提交中…" : "提交更换"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
