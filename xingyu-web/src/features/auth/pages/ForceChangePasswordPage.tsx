import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { AuthCard } from "@/features/auth/components/AuthCard";
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

  return (
    <AuthCard title="请修改密码" description="出于安全原因，你需要先设置一个新的密码。">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">新密码</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{passwordRulesHint(passwordRules)}</p>
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
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : "保存新密码"}
        </Button>
      </form>
    </AuthCard>
  );
}
