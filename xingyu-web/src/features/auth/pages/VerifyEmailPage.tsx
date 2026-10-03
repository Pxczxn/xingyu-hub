import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { cn } from "@/lib/cn";
import { authApi } from "@/api/auth/auth.api";
import { Button } from "@/components/ui/button";

/**
 * Email verification (Phase 1A).
 * Real contract: POST /api/v1/auth/email/verify { token } and
 * POST /api/v1/auth/email/resend { email? }.
 * When a ?token= is present the page verifies automatically.
 */
/*
 * One shape for all three states: a state glyph, a conclusion, an explanation,
 * and — only where one exists — a single action.
 *
 * All three states used to render through `AuthCard`, i.e. the LOGIN FORM's
 * shell: a title, a description and a body slot. None of the three is a form.
 * Someone arriving from a verification link wants "did it work?" answered before
 * anything else, and a form shell buries that answer under a header sized for a
 * form to sit under.
 *
 * The glyph carries the state so the reader gets it before reading: a spinner
 * while it is in flight, a gold check when it worked, a warning envelope when
 * there is still something to do.
 */
function StatusPanel({
  icon,
  disc,
  title,
  body,
  action,
  live = false,
}: {
  icon: React.ReactNode;
  disc: string;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-border/70 bg-card px-6 py-7 text-center"
      {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      <span
        className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full", disc)}
        aria-hidden
      >
        {icon}
      </span>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-primary">{title}</h1>
      <div className="mx-auto mt-2 max-w-sm text-meta leading-6 text-muted-foreground">{body}</div>
      {action ? <div className="mt-5 flex flex-col items-center gap-3">{action}</div> : null}
    </div>
  );
}

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
      <StatusPanel
        live
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        disc="bg-surface-sunken text-muted-foreground"
        title="正在验证邮箱"
        body="正在验证，请稍候…"
      />
    );
  }

  if (status === "success") {
    return (
      <StatusPanel
        icon={<CheckCircle2 className="h-5 w-5" />}
        disc="bg-accent-soft text-accent-strong"
        title="邮箱验证成功"
        body="你的邮箱已验证，现在可以登录了。"
        action={
          <Link
            to="/login"
            className="focus-ring rounded-md bg-primary px-4 py-2 text-meta font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            前往登录
          </Link>
        }
      />
    );
  }

  const failed = status === "error";

  return (
    <StatusPanel
      icon={<MailWarning className="h-5 w-5" />}
      disc={
        failed ? "bg-destructive/10 text-destructive" : "bg-surface-sunken text-foreground-soft"
      }
      title={failed ? "验证未完成" : "验证你的邮箱"}
      body={
        <>
          我们已向 <strong className="font-medium text-foreground">{email || "你的邮箱"}</strong>{" "}
          发送验证链接。请查收邮件并点击链接完成验证。
        </>
      }
      action={
        <>
          {failed && message ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-meta text-destructive"
            >
              {message}
            </p>
          ) : null}

          {message && !failed ? <p className="text-meta text-muted-foreground">{message}</p> : null}

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

          <Link
            to="/login"
            className="focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
          >
            返回登录
          </Link>
        </>
      }
    />
  );
}
