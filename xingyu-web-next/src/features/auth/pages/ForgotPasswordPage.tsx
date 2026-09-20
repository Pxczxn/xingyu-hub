import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Forgot password (Phase 1A).
 * Real contract: POST /api/v1/auth/password-recovery { login }.
 */
export function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const result = await authApi.requestPasswordRecovery(login);
      setSent(true);
      if (result.mailPending) {
        setNotice("邮件通道暂未配置，请联系管理员或稍后再试。");
      } else if (result.devResetLink) {
        // Backend can expose a dev-only reset link; show it instead of inventing one.
        setNotice(`开发环境重置链接：${result.devResetLink}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : "请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="找回密码"
      description="输入注册时使用的邮箱或用户名，我们会发送重置链接。"
      footer={
        <Link to="/login" className="text-accent hover:underline">
          返回登录
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            重置链接已发送（如该账号存在）。请查收邮件并按提示操作。
          </p>
          {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login">邮箱或用户名</Label>
            <Input
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting || !login}>
            {submitting ? "发送中…" : "发送重置链接"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
