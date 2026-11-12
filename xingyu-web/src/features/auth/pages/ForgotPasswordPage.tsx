import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { ArchetypeFrame } from "@/components/layout";
import { AuthActionBar } from "@/features/auth/components/AuthActionBar";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import {
  AuthStatusPanel,
  authStatusLinkClass,
  authStatusPrimaryClass,
} from "@/features/auth/components/AuthStatusPanel";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Forgot password (Phase 1A).
 * Real contract: POST /api/v1/auth/password-recovery { login }.
 *
 * --- 2026-11-10 批次 C：SK5 · 线 / 紧 / 齐 -------------------------------
 * 线：`AuthCard variant="line"`（无卡面的 masthead + 发丝线），成功态用
 * `AuthStatusPanel variant="line"` —— 两种状态同一个 H 值，标题不会在提交后跳字号
 * 也不会突然多出一圈边框。
 * 紧：`density="compact"` + `contentClassName="gap-3"`。本页只有一个字段，任务单一，
 * 与 `/login` 的「松」（每字段带说明行）拉开密度差。
 * 齐：无侧栏，所有块与窄栏同宽。
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
      setError(
        err instanceof ApiError
          ? err.problem.detail || err.problem.title
          : "请求失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
    The success state is NOT a form, so it does not use the form's shell.
    Once the link is on its way there is nothing left to type — the only things
    to say are "it was sent" (with the deliberate hedge: the backend does not
    reveal whether the account exists) and "check your mail". A card shaped like
    a form makes the reader hunt for a field that is not there.
  */
  if (sent) {
    return (
      <ArchetypeFrame skeleton="SK5" header="shell" density="compact">
        <AuthStatusPanel
          variant="line"
          icon={<MailCheck className="h-5 w-5" />}
          disc="bg-accent-soft text-accent-strong"
          title="重置链接已发送"
          body={
            <>
              如该账号存在，我们已经发送了重置链接。请查收邮件并按提示操作。
              {notice ? <span className="mt-2 block">{notice}</span> : null}
            </>
          }
          action={
            <>
              <Link to="/login" className={authStatusPrimaryClass}>
                返回登录
              </Link>
              <button type="button" onClick={() => setSent(false)} className={authStatusLinkClass}>
                换一个账号再试
              </button>
            </>
          }
        />
      </ArchetypeFrame>
    );
  }

  return (
    <ArchetypeFrame skeleton="SK5" header="shell" density="compact">
      <AuthCard
        variant="line"
        title="找回密码"
        description="输入注册时使用的邮箱或用户名，我们会发送重置链接。"
        contentClassName="gap-3"
        footer={
          <Link to="/login" className="text-accent-strong hover:underline">
            返回登录
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login">邮箱或用户名</Label>
            <Input
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "forgot-error" : undefined}
              required
            />
          </div>

          {error ? (
            <AuthFormError id="forgot-error" testId="forgot-password-error" focusOnMount>
              {error}
            </AuthFormError>
          ) : null}

          <AuthActionBar>
            <Button type="submit" disabled={submitting || !login}>
              {submitting ? "发送中…" : "发送重置链接"}
            </Button>
          </AuthActionBar>
        </form>
      </AuthCard>
    </ArchetypeFrame>
  );
}
