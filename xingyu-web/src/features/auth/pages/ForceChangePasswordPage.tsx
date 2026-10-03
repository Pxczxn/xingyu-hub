import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import { passwordRulesHint, validatePasswordClient } from "@/lib/password-rules";
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

  useEffect(() => {
    getPublicConfig()
      .then((config) => setPasswordRules(config.password))
      .catch(() => undefined);
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
   */
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-accent-line/60 bg-accent-soft px-4 py-3.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
        <p className="text-meta leading-6 text-foreground-soft">
          这是一次<strong className="font-semibold text-primary">强制</strong>
          修改：在你设置新密码之前，账号的其它功能不可用。
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight text-primary">请修改密码</h1>
        <p className="mt-1.5 text-meta leading-6 text-muted-foreground">
          设置新密码后即可继续使用账号。
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
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
            <p
              role="alert"
              className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-meta text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "提交中…" : "保存新密码"}
          </Button>
        </form>
      </div>
    </div>
  );
}
