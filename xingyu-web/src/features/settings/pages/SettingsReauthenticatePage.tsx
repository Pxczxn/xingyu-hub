import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { ApiError } from "@/api/client";
import { ArchetypeFrame, BleedBand } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { checkPasswordForReauth } from "@/features/settings/account-security";
import { setStoredRecentAuth } from "@/features/settings/recent-auth";

/*
 * /settings/security/re-authenticate (Phase 3H).
 *
 * Why this page is a prerequisite, not a nicety: two endpoints refuse without an
 * `X-Recent-Auth` grant (403 「请先完成身份再认证」) —
 *   - `POST /me/email/change`     (2026-10-08: still checks only)
 *   - `POST /me/account/deletion-request` (2026-10-08: additionally CONSUMES it)
 * This page mints one from the current password and stores it in sessionStorage
 * for 15 minutes (the backend's `VALID_MINUTES`).
 *
 * 2026-10-08: the grant became single-use for deactivation. The copy below says
 * 「15 分钟内有效」and must not imply "unlimited uses" — for deactivation it is
 * strictly one shot. This page does not need to say so (the destructive page
 * does), but it must not claim the opposite either.
 *
 * It accepts an optional `?returnTo=` so the email-change or deactivation page
 * can bounce the user here and get them back — the Legacy page did the same.
 * Only a known-safe relative path is honoured; an absolute URL is ignored, so
 * the parameter cannot be used as an open redirect.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * This page was typeset as a settings SECTION — same heading, same full-width
 * form, same left alignment as 隐私 or 屏蔽管理. But it is not a setting: it is a
 * STEP in someone else's flow (changing the email, deactivating the account).
 * Rendering a flow step as a settings section invites the reader to treat it as
 * a place to browse.
 *
 * It is now a single CENTRED, NARROW card (max-w-md) — the shape a flow step has
 * when it interrupts you — with the shield mark, one field and one action. The
 * width is the message: there is nothing else to do here.
 *
 * NOTE (2026-11-10 更正): 上一段写的"仍然渲染在 settings 壳内"已经过期 ——
 * `routes.tsx:1044-1051` 已经把本页从 `SettingsLayout` 那一组里提出来了（组在
 * `:1027` 收口），所以本页**没有壳层 h1**，必须自己出恰好 1 个 h1（A §7.2 的 B 类壳）。
 *
 * --- 2026-11-10 批次 C：SK5 · 线 / 松 / 出 -------------------------------
 * 线：masthead 不带卡面（eyebrow + 图标 + h1 + 说明行），靠出血带的上下发丝线收边。
 * 出：`BleedBand` 让这一条比页内其它块都宽（`-mx-4/md:-mx-6` 抵消 `.content-shell`
 *     的 `px-4/md:px-6`），其后内容回到 640px 窄栏。带本身是 canvas 底，不是彩色横幅，
 *     所以它是"整幅节奏"而不是 H=幅。
 * 松：字段卡内 24px 边距、块间 40px。
 * 提交与 grant 存储逻辑一行未动。
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
      <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
        <PageState
          kind="empty"
          title="身份验证成功"
          description="验证结果 15 分钟内有效，现在可以修改邮箱或停用账号了。"
        />
        <p className="text-center">
          <Link
            to="/settings/security/email"
            className="focus-ring rounded-sm text-meta text-accent-strong hover:underline"
          >
            去修改邮箱
          </Link>
        </p>
      </ArchetypeFrame>
    );
  }

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
      {/*
        H=线：标题不带卡面，落在出血带里的内容列左缘；R=出：这条带比页内任何块都宽
        （`BleedBand` 的 `-mx-4/md:-mx-6` 正好抵消 `.content-shell` 的 `px-4/6`），
        带本身用 canvas 底 + 上下发丝线 —— 有"整幅"的节奏，没有"横幅"的面色，
        所以它不是 H=幅。其后所有块回到 640px 窄栏（SK5）。
      */}
      <BleedBand labelledBy="reauth-heading">
        <div className="mx-auto w-full max-w-[40rem]">
          <p className="eyebrow">账号安全</p>
          <div className="mt-2 flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-surface-sunken text-foreground-soft"
              aria-hidden
            >
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {/*
               An h1, not the h2 it used to be. When this page lived inside
               SettingsLayout that shell supplied the page heading, so an h2 was
               correct. Standalone, it is the only heading on the screen and an
               outline that starts at level 2 is a broken outline.
             */}
              <h1
                id="reauth-heading"
                className="text-2xl font-semibold tracking-tight text-primary"
              >
                身份再验证
              </h1>
              <p className="mt-1.5 max-w-[36rem] text-meta leading-6 text-muted-foreground">
                为保护账号，修改邮箱或停用账号前需要先用当前密码验证身份，验证结果 15
                分钟内有效。
              </p>
            </div>
          </div>
        </div>
      </BleedBand>

      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-[40rem] flex-col gap-5"
        data-testid="reauth-form"
      >
        <div className="rounded-card border border-border/70 bg-card p-6">
          {submitError ? (
            <p
              role="alert"
              data-testid="reauth-error"
              className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-meta text-destructive"
            >
              {submitError}
            </p>
          ) : null}

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
              className="focus-ring h-9 rounded-control border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          {fieldError ? (
            <p role="alert" className="mt-2 text-meta text-destructive">
              {fieldError}
            </p>
          ) : null}
        </div>

        {/* SK5 的粘底操作条（`StepFlow` 的同一条配方：上发丝线 + 半透明 + backdrop-blur）。 */}
        <div className="sticky bottom-0 z-rail border-t border-border/70 bg-card/95 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="submit" disabled={busy} data-testid="reauth-submit">
              {busy ? "验证中…" : "验证身份"}
            </Button>
          </div>
        </div>
      </form>
    </ArchetypeFrame>
  );
}
