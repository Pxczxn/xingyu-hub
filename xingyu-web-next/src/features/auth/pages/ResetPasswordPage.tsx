import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { getPublicConfig } from "@/lib/public-config";
import { passwordRulesHint, validatePasswordClient } from "@/lib/password-rules";
import type { PasswordPolicy } from "@/api/auth/auth.types";
import { useEffect } from "react";

/**
 * Reset password (Phase 1A).
 * Real contract: POST /api/v1/auth/password-reset { token, password }.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
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
      await authApi.resetPassword({ token, password });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : "重置失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard
        title="链接无效"
        description="重置密码需要邮件中的 token。"
        footer={
          <Link to="/forgot-password" className="text-accent hover:underline">
            重新申请重置链接
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">当前链接缺少 token，请回到邮箱点击完整链接。</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="设置新密码"
      footer={
        <Link to="/login" className="text-accent hover:underline">
          返回登录
        </Link>
      }
    >
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
          {submitting ? "提交中…" : "重置密码"}
        </Button>
      </form>
    </AuthCard>
  );
}
