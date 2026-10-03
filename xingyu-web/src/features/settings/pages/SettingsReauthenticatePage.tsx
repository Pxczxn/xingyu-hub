import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { checkPasswordForReauth } from "@/features/settings/account-security";
import { setStoredRecentAuth } from "@/features/settings/recent-auth";

/*
 * /settings/security/re-authenticate (Phase 3H).
 *
 * Why this page is a prerequisite, not a nicety: `POST /me/email/change` refuses
 * without an `X-Recent-Auth` grant (403 「请先完成身份再认证」). This page mints
 * one from the current password and stores it in sessionStorage for 15 minutes
 * (the backend's `VALID_MINUTES`).
 *
 * It accepts an optional `?returnTo=` so the email-change page can bounce the
 * user here and get them back — the Legacy page did the same. Only a
 * known-safe relative path is honoured; an absolute URL is ignored, so the
 * parameter cannot be used as an open redirect.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * This page was typeset as a settings SECTION — same heading, same full-width
 * form, same left alignment as 隐私 or 屏蔽管理. But it is not a setting: it is a
 * STEP in someone else's flow (changing the email). Rendering a flow step as a
 * settings section invites the reader to treat it as a place to browse.
 *
 * It is now a single CENTRED, NARROW card (max-w-md) — the shape a flow step has
 * when it interrupts you — with the shield mark, one field and one action. The
 * width is the message: there is nothing else to do here.
 *
 * NOTE: the page still renders INSIDE the settings shell, so the area nav is
 * visible. Moving it out of the shell is a route-table change (it currently sits
 * under the SettingsLayout branch) and is tracked as a follow-up rather than
 * bundled into this structure pass.
 * ---------------------------------------------------------------------------
 */

const ALLOWED_RETURN_PREFIXES = ["/settings/"];

/** Returns the path only when it is a same-site `/settings/...` route. */
export function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  // Reject protocol-relative (`//evil.com`) and absolute URLs outright.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return ALLOWED_RETURN_PREFIXES.some((prefix) => value.startsWith(prefix)) ? value : null;
}

export function SettingsReauthenticatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const check = checkPasswordForReauth(password);
    if (!check.ok) {
      setFieldError(check.message);
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      const grant = await accountApi.reAuthenticate(password);
      // `expiresAt` is always present from the backend, but fall back to the
      // documented 15-minute window rather than storing an unusable grant.
      const expiresAt = grant.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString();
      setStoredRecentAuth(grant.recentAuthId, expiresAt);
      setPassword("");
      setDone(true);
      if (returnTo) navigate(returnTo, { replace: true });
    } catch (error) {
      // A wrong password is 401 AUTH_INVALID_CREDENTIALS. Do not "helpfully"
      // reveal which part was wrong beyond what the server already says.
      setSubmitError(
        error instanceof ApiError ? error.problem.detail : "身份验证失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done && !returnTo) {
    return (
      <div className="section-gap">
        <div className="mx-auto w-full max-w-md">
          <PageState
            kind="empty"
            title="身份验证成功"
            description="验证结果 15 分钟内有效，现在可以修改邮箱了。"
          />
          <p className="mt-3 text-center">
            <Link
              to="/settings/security/email"
              className="focus-ring rounded-sm text-meta text-accent-strong hover:underline"
            >
              去修改邮箱
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <span
            className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-strong"
            aria-hidden
          >
            <ShieldCheck className="h-5 w-5" />
          </span>

          {/*
             An h1, not the h2 it used to be. When this page lived inside
             SettingsLayout that shell supplied the page heading, so an h2 was
             correct. Standalone, it is the only heading on the screen and an
             outline that starts at level 2 is a broken outline.
           */}
          <h1
            id="reauth-heading"
            className="mt-3 text-center text-xl font-semibold tracking-tight text-primary"
          >
            身份再验证
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-center text-meta text-muted-foreground">
            为保护账号，修改邮箱前需要先用当前密码验证身份，验证结果 15 分钟内有效。
          </p>

          {submitError ? (
            <p
              role="alert"
              data-testid="reauth-error"
              className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-meta text-destructive"
            >
              {submitError}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3" data-testid="reauth-form">
            <label className="flex flex-col gap-1.5 text-meta text-foreground-soft">
              当前密码
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                aria-invalid={fieldError ? true : undefined}
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
            <Button type="submit" disabled={busy} data-testid="reauth-submit" className="w-full">
              {busy ? "验证中…" : "验证身份"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
