import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
      const expiresAt =
        grant.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString();
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
        <PageState
          kind="empty"
          title="身份验证成功"
          description="验证结果 15 分钟内有效，现在可以修改邮箱了。"
        />
        <Link to="/settings/security/email" className="text-sm text-accent hover:underline">
          去修改邮箱
        </Link>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <section aria-labelledby="reauth-heading">
        <h2 id="reauth-heading" className="text-base font-semibold text-primary">
          身份再验证
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          为保护账号，修改邮箱前需要先用当前密码验证身份，验证结果 15 分钟内有效。
        </p>
      </section>

      {submitError ? (
        <p role="alert" data-testid="reauth-error" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3" data-testid="reauth-form">
        <label className="flex flex-col gap-1 text-sm text-foreground">
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
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {fieldError ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={busy} data-testid="reauth-submit">
            {busy ? "验证中…" : "验证身份"}
          </Button>
        </div>
      </form>
    </div>
  );
}
