"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";
import { passwordRulesHint, validatePasswordClient } from "@/lib/password-rules";
import type { PublicConfig } from "@/lib/community-api";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordRules, setPasswordRules] = useState<PublicConfig["password"] | undefined>();

  useEffect(() => {
    getPublicConfig()
      .then((config) => setPasswordRules(config.password))
      .catch(() => undefined);
  }, []);

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const passwordError = validatePasswordClient(password, passwordRules);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!token) {
      setError("重置链接无效，请重新申请");
      return;
    }
    setSubmitting(true);
    try {
      await communityApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "重置失败");
      else setError("重置失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthPageShell
        eyebrow="账号恢复"
        title="密码已更新"
        description="所有旧会话已失效，请使用新密码重新登录。"
        footer={
          <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
            去登录
          </Link>
        }
      >
        <Alert variant="success">密码重置成功，可以登录了。</Alert>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="账号恢复"
      title="设置新密码"
      description={`${passwordRulesHint(passwordRules)}。链接有效期 1 小时。`}
      footer={
        <>
          链接失效？{" "}
          <Link href="/forgot-password" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
            重新申请
          </Link>
        </>
      }
    >
      {!token && (
        <Alert variant="destructive" className="mb-4">
          重置链接无效或已过期，请重新申请。
        </Alert>
      )}
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submitReset(event);
        }}
      >
        <div>
          <Label htmlFor="password">{passwordRulesHint(passwordRules)}</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={passwordRules?.minLength ?? 6}
            maxLength={passwordRules?.maxLength ?? 64}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm">确认新密码</Label>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            required
          />
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button
          className="mt-2 h-11 bg-[#13234d] text-base hover:bg-[#1b326d]"
          type="submit"
          disabled={submitting || !token}
        >
          {submitting ? "提交中…" : "设置新密码"}
        </Button>
      </form>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-[#f8f7f3] text-sm text-slate-600">
          正在准备重置页…
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
