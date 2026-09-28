import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { Button } from "@/components/ui/button";

/**
 * Email verification (Phase 1A).
 * Real contract: POST /api/v1/auth/email/verify { token } and
 * POST /api/v1/auth/email/resend { email? }.
 * When a ?token= is present the page verifies automatically.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token");

  const [status, setStatus] = useState<"pending" | "verifying" | "success" | "error">(
    token ? "verifying" : "pending",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!active) return;
        setStatus("success");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setMessage("验证失败，链接可能已过期，请重新发送验证邮件。");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setMessage(null);
    try {
      const result = await authApi.resendEmailVerification(email);
      setResent(true);
      setMessage(
        result.mailPending ? "验证邮件发送失败，请稍后再试。" : "验证邮件已发送，请查收邮箱。",
      );
    } catch {
      setMessage("发送失败，请稍后再试。");
    } finally {
      setResending(false);
    }
  }

  if (status === "verifying") {
    return (
      <AuthCard title="正在验证邮箱">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          正在验证，请稍候…
        </p>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard
        title="邮箱验证成功"
        footer={
          <Link to="/login" className="text-accent hover:underline">
            前往登录
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">你的邮箱已验证，现在可以登录了。</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="验证你的邮箱"
      footer={
        <Link to="/login" className="text-accent hover:underline">
          返回登录
        </Link>
      }
    >
      <p className="text-sm text-muted-foreground">
        我们已向 <strong className="text-foreground">{email || "你的邮箱"}</strong>{" "}
        发送验证链接。请查收邮件并点击链接完成验证。
      </p>

      {status === "error" && message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {message && status !== "error" ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {email ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void resend()}
          disabled={resending || resent}
        >
          {resending ? "发送中…" : resent ? "已发送" : "重新发送验证邮件"}
        </Button>
      ) : null}
    </AuthCard>
  );
}
