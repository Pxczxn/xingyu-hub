"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError, getStoredToken } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";
import { passwordRulesHint, validatePasswordClient } from "@/lib/password-rules";
import type { PublicConfig } from "@/lib/community-api";

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [passwordRules, setPasswordRules] = useState<PublicConfig["password"] | undefined>();

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?returnTo=/force-change-password");
      return;
    }
    Promise.all([getPublicConfig(), communityApi.getMe()])
      .then(([config, me]) => {
        setPasswordRules(config.password);
        if (!me.mustChangePassword) {
          router.replace("/");
        }
      })
      .catch(() => {
        router.replace("/login?returnTo=/force-change-password");
      })
      .finally(() => setChecking(false));
  }, [router]);

  async function onSubmit(event: FormEvent) {
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
    setSubmitting(true);
    try {
      await communityApi.forceChangePassword(password);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "修改密码失败");
      else setError("修改密码失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f8f7f3] text-sm text-slate-600">
        正在验证账号状态…
      </main>
    );
  }

  return (
    <AuthPageShell
      eyebrow="账号安全"
      title="设置新密码"
      description="管理员已为你重置密码。请立即设置新的登录密码，完成后才能继续使用社区。"
      footer={
        <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
          退出并重新登录
        </Link>
      }
    >
      <Alert variant="default" className="mb-4">
        临时密码仅可使用一次且有时效限制，请设置你自己的新密码。
      </Alert>
      <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
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
            minLength={passwordRules?.minLength ?? 6}
            required
          />
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button className="mt-2 h-11 bg-[#13234d] text-base hover:bg-[#1b326d]" type="submit" disabled={submitting}>
          {submitting ? "提交中…" : "确认新密码"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
