"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitRecovery(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevResetLink(null);
    setSubmitting(true);
    try {
      const result = await communityApi.requestPasswordRecovery(login);
      if (result.devResetLink) {
        setDevResetLink(result.devResetLink);
        setMessage("邮件通道暂未配置。本地开发可直接使用下方重置链接（1 小时内有效）。");
      } else if (result.mailPending) {
        setMessage("如果账号存在，我们已尝试发送重置邮件。若未收到，请检查邮件配置或联系管理员。");
      } else {
        setMessage("如果账号存在，我们已向注册邮箱发送重置链接。请查收邮件并在 1 小时内完成重置。");
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "请求失败");
      else setError("请求失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="账号恢复"
      title="找回访问权限"
      description="输入注册邮箱或用户名。若账号存在，我们会向注册邮箱发送重置链接。"
      footer={
        <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
          返回登录
        </Link>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submitRecovery(event);
        }}
      >
        <div>
          <Label htmlFor="login">邮箱或用户名</Label>
          <Input
            id="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        {message && <Alert>{message}</Alert>}
        {devResetLink && (
          <Alert>
            <p className="text-sm">开发环境重置链接：</p>
            <Link
              href={devResetLink}
              className="mt-2 block break-all text-sm font-medium text-[#35457f] underline-offset-4 hover:underline"
            >
              {devResetLink}
            </Link>
          </Alert>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button
          className="mt-2 h-11 bg-[#13234d] text-base hover:bg-[#1b326d]"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "提交中…" : "发送重置链接"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
