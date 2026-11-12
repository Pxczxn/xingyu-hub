import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, ShieldAlert } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { authApi } from "@/api/auth/auth.api";
import { ApiError } from "@/api/client";
import { ArchetypeFrame, TableFrame } from "@/components/layout";
import { PageSection } from "@/components/shared/PageSection";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";
import { checkNewEmail, emailChangeNotice } from "@/features/settings/account-security";
import { getStoredRecentAuth } from "@/features/settings/recent-auth";

/*
 * /settings/security/email (Phase 3H).
 *
 * Contract (re-verified 2026-10-08 against CommunityMeController +
 * CommunityAccountService):
 *   POST /api/v1/me/email/change  { newEmail, password }  + X-Recent-Auth
 *     -> { currentEmail, pendingEmail, mailPending }
 *
 * TWO THINGS THIS PAGE MUST NOT GET WRONG:
 *
 *  1. **Submitting does not change the email here.** The backend mails a
 *     confirmation link to the NEW address; only following that link activates
 *     it. So the success copy says "已发送确认邮件", never "邮箱已修改".
 *  2. **`mailPending: false` is a failure.** It means the mail could not be
 *     delivered, so the change will never complete. The notice is rendered as a
 *     warning and the current email is named as still valid.
 *
 * --- 2026-10-08 (Settings Contract Recovery, B1) ---------------------------
 * Item 1 used to be a LIE, not just a nuance: `verifyEmail` hardcoded
 * `purpose = REGISTER`, and nothing in the codebase ever consumed an
 * EMAIL_CHANGE token or rebound `user.email`. The promise "完成确认后新邮箱才会生效"
 * could never come true.
 *
 * That is fixed server-side. The confirmation link now really does rebind, and
 * the copy has to reflect two consequences that did not exist before:
 *   - confirming revokes EVERY session (so the user ends up logged out),
 *   - the old address stops working for login immediately.
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
 *
 * --- 2026-11-10 批次 C：SK3 · 壳 / 表 / 错 -------------------------------
 * 「CURRENT-VALUE CARD」换成一张两列的表：本页的主体就是「项目 / 值」的三行事实
 * （邮箱、验证状态、生效方式），可逐行核对，属 D=表（本域只有本页与 API Token 是表）。
 * R=错：再验证状态与"确认后会发生什么"搬进 280 侧轨 —— 它们是前置条件与后果，不是
 * 当前值，挤在正文里会把「我的邮箱是什么」推到第二屏。侧轨不重复地址本身
 * （否则 `getByText(email)` 会命中两个节点）。
 * 壳：h1「修改邮箱」仍由本页的 `PageSection` h2 承担层级起点，`SettingsLayout` 出 h1。
 * 提交逻辑 / grant 判据 / 字段校验 / 面板 toggle 一行未动。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setMeState("loading");
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
  }, [reloadKey]);

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

  if (meState === "loading") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
        <PageState kind="loading" />
      </ArchetypeFrame>
    );
  }
  if (meState === "error") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
        <PageState kind="error" title="无法读取账号信息" description="请确认登录状态后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </ArchetypeFrame>
    );
  }

  return (
    <ArchetypeFrame
      skeleton="SK3"
      header="shell"
      density="dense"
      railLabel="身份验证"
      rail={
        /*
          R=错：主列 + 280 侧轨。侧轨放的是**这一页的前置条件**（再验证是否还有效）
          与后果说明 —— 它们原来挤在正文里，把"当前邮箱是什么"这个主要问题推到了
          第二屏。侧轨不重复正文里的地址（那样 `getByText(email)` 会命中两个节点）。
        */
        <div className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-4">
          {!hasGrant ? (
            <div className="flex flex-col gap-2" data-testid="email-need-reauth">
              <p className="text-meta leading-6 text-foreground">修改邮箱前需要先验证身份。</p>
              <Link
                to="/settings/security/re-authenticate?returnTo=/settings/security/email"
                className="focus-ring w-fit rounded-control bg-primary px-3 py-2 text-meta font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                去验证身份
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground">
                身份验证
              </p>
              <p className="text-meta leading-6 text-foreground-soft">
                已验证，有效期 15 分钟；过期后需要重新验证。
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
            <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground">
              确认后会发生什么
            </p>
            <p className="text-meta leading-6 text-muted-foreground">
              需在新邮箱完成确认才生效；确认时你会退出所有设备的登录状态，原邮箱立即不能用于登录。
            </p>
          </div>
        </div>
      }
    >
      <PageSection
        id="email-heading"
        title="修改邮箱"
        description="邮箱用于登录、找回密码与接收通知。更换后需要在新邮箱完成确认才会生效。"
      >
        {/*
          D=表：本页的主体是「账号现在的邮箱状态」—— 项目 / 值两列，可以逐行核对，
          所以用 `TableFrame` 而不是卡片或说明段落。这是本域两个「表」页之一
          （另一个是 API Token），与四个「紧」页的差别就是这条表头带与对齐列。
        */}
        <TableFrame caption="邮箱状态">
          <thead>
            <tr>
              <th scope="col" className="w-[8rem]">
                项目
              </th>
              <th scope="col">当前值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="whitespace-nowrap">
                邮箱
              </th>
              <td>
                {/* The verification state stays INSIDE `email-current` rather than
                    living only in the badge beside it: this element is what a screen
                    reader reads out as the current address, and "is it verified?" is
                    part of that answer. */}
                <span
                  data-testid="email-current"
                  className="break-all font-medium text-primary"
                >
                  当前邮箱：{me?.email ?? "—"}
                  {me && !me.emailVerified ? "（尚未验证）" : ""}
                </span>
              </td>
            </tr>
            <tr>
              <th scope="row" className="whitespace-nowrap">
                验证状态
              </th>
              <td>
                {me && me.emailVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-meta text-success">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-success" />
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    已验证
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-meta text-destructive">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-destructive" />
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                    待验证
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <th scope="row" className="whitespace-nowrap">
                生效方式
              </th>
              <td className="text-meta">提交后需在新邮箱点确认链接；确认后需重新登录。</td>
            </tr>
          </tbody>
        </TableFrame>

        {submitError ? (
          <p
            role="alert"
            data-testid="email-error"
            className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
          >
            {submitError}
          </p>
        ) : null}

        {notice ? (
          <p
            role={notice.tone === "warning" ? "alert" : "status"}
            data-testid={`email-notice-${notice.tone}`}
            className={cn(
              "mt-4 rounded-lg border px-4 py-2.5 text-meta",
              notice.tone === "warning"
                ? "border-destructive/25 bg-destructive/5 text-destructive"
                : "border-border/70 bg-surface-sunken text-foreground-soft",
            )}
          >
            {notice.message}
          </p>
        ) : null}

        {/* The change panel. Toggled, never unmounted — see the header note. */}
        <div className="mt-4 overflow-hidden rounded-card border border-border/70 bg-card">
          <button
            type="button"
            aria-expanded={formOpen}
            aria-controls="email-change-form"
            onClick={() => setFormOpen((open) => !open)}
            className="focus-ring flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken/60"
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
            className={cn(
              "flex flex-col gap-3 border-t border-border/70 p-4",
              !formOpen && "hidden",
            )}
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
                className="focus-ring h-9 rounded-control border border-input bg-card px-3 text-sm text-foreground"
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
                className="focus-ring h-9 rounded-control border border-input bg-card px-3 text-sm text-foreground"
              />
            </label>
            {fieldError ? (
              <p role="alert" className="text-meta text-destructive">
                {fieldError}
              </p>
            ) : null}
            <p className="text-meta text-muted-foreground">
              提交后会向新邮箱发送确认邮件，完成确认后新邮箱才会生效；确认后需要重新登录。
            </p>
            <div>
              <Button type="submit" disabled={busy} data-testid="email-submit">
                {busy ? "提交中…" : "提交更换"}
              </Button>
            </div>
          </form>
        </div>
      </PageSection>
    </ArchetypeFrame>
  );
}
