import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import {
  PASSWORD_POLICY_FALLBACK_NOTICE,
  passwordRulesHint,
  usingFallbackPasswordPolicy,
  validatePasswordClient,
} from "@/lib/password-rules";
import type { PasswordPolicy } from "@/api/auth/auth.types";

/**
 * Force change password (Phase 1A).
 * Real contract: POST /api/v1/me/password/force-change { newPassword }.
 * Mirrors Legacy behaviour: anonymous users are sent to login with a returnTo,
 * and users without mustChangePassword are sent home.
 */
export function ForceChangePasswordPage() {
  const { status, user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordRules, setPasswordRules] = useState<PasswordPolicy | undefined>();
  // policy 拉不到时不再静默：强制改密页尤其不能让人以为「怎么输都改不完」。
  const [passwordPolicyFallback, setPasswordPolicyFallback] = useState(false);

  useEffect(() => {
    getPublicConfig()
      .then((config) => {
        setPasswordRules(config.password);
        setPasswordPolicyFallback(usingFallbackPasswordPolicy(config.password));
      })
      .catch(() => setPasswordPolicyFallback(true));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate("/login?returnTo=/force-change-password", { replace: true });
      return;
    }
    if (status === "authenticated" && user && !user.mustChangePassword) {
      navigate("/", { replace: true });
    }
  }, [status, user, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    const ruleError = validatePasswordClient(password, passwordRules);
    if (ruleError) {
      setError(ruleError);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.forceChangePassword(password);
      await refreshUser();
      navigate("/", { replace: true });
    } catch {
      setError("修改失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * A FORCED flow, and it says so.
   *
   * The old version rendered through `AuthCard` — the same shell as a voluntary
   * login or register screen — with the only hint of compulsion being the word
   * "出于安全原因" in a description line. A reader cannot tell from that whether
   * they can leave, so the honest framing goes first: a notice band stating that
   * the account's other functions are unavailable until this is done.
   *
   * There is deliberately no back link and no secondary action. A screen that
   * offers an escape it cannot honour is worse than one that offers none, and
   * the route is reached only when the server says the password must change.
   *
   * --- 2026-11-10 批次 C：SK5 · 线 / 松 / 齐 -------------------------------
   * 线：`AuthCard variant="line"` 改为页内的无面 masthead（图标 + h1 + 说明行 +
   *     一条发丝线）。原来那圈卡边把「强制」页面画成了一个可阅读的区块。
   *     强制说明带仍然在**字段之前**（原文案的用意不变），只是从"卡内的一条"变成了
   *     masthead 与表单之间的独立一块。
   * 松：`density="loose"` + 字段 `gap-5`，两个密码框之间留出说明行的位置。
   * 齐：无侧栏，所有块与窄栏同宽；终点动作进 `AuthActionBar`（仍在 `<form>` 内）。
   * 提交流程、两个重定向 effect、密码校验一行未动。
   */
  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="loose">
      <header className="border-b border-border/70 pb-4">
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-surface-sunken text-foreground-soft"
            aria-hidden
          >
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-primary">请修改密码</h1>
            <p className="mt-1.5 text-meta leading-6 text-muted-foreground">
              设置新密码后即可继续使用账号。
            </p>
          </div>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-card border border-border/70 bg-surface-sunken px-4 py-3.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
        <p className="text-meta leading-6 text-foreground-soft">
          这是一次<strong className="font-semibold text-primary">强制</strong>
          修改：在你设置新密码之前，账号的其它功能不可用。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">新密码</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-meta text-muted-foreground">{passwordRulesHint(passwordRules)}</p>
          {passwordPolicyFallback ? (
            <p role="status" className="text-meta text-warning">
              {PASSWORD_POLICY_FALLBACK_NOTICE}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">确认新密码</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error ? (
          <AuthFormError testId="force-change-error" focusOnMount>
            {error}
          </AuthFormError>
        ) : null}

        <AuthActionBar>
          <Button type="submit" disabled={submitting}>
            {submitting ? "提交中…" : "保存新密码"}
          </Button>
        </AuthActionBar>
      </form>
    </ArchetypeFrame>
  );
}
