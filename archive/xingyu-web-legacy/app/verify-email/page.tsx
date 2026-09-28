"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { getPublicConfig } from "@/lib/public-config";

function VerifyEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token");
  const mailPending = params.get("mailPending") === "1";
  const registered = params.get("registered") === "1";
  const [verifyEmailRequired, setVerifyEmailRequired] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"pending" | "verifying" | "verified" | "error">(
    token ? "verifying" : "pending"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    getPublicConfig({ fresh: true })
      .then((config) => setVerifyEmailRequired(config.registration?.verifyEmail === true))
      .catch(() => setVerifyEmailRequired(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    communityApi.verifyEmail(token)
      .then(() => {
        setStatus("verified");
        setMessage("邮箱已验证，可以登录了。");
      })
      .catch((err) => {
        setStatus("error");
        if (err instanceof ApiError) setMessage(err.problem.detail || err.problem.title);
        else setMessage("验证失败");
      });
  }, [token]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setMessage(null);
    try {
      const result = await communityApi.resendEmailVerification(email);
      setMessage(
        result.mailPending
          ? "邮件通道暂未配置，验证邮件发送暂时失败，请稍后重试。"
          : "验证邮件已重新发送，请查收。"
      );
    } catch (err) {
      if (err instanceof ApiError) setMessage(err.problem.detail || err.problem.title);
      else setMessage("发送失败，请稍后重试");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="账号安全"
      title="验证邮箱"
      description={
        verifyEmailRequired === false
          ? "当前未开启登录前邮箱验证，可直接登录使用社区。"
          : "完成邮箱验证后，即可使用全部社区功能并接收重要通知。"
      }
      footer={
        <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
          返回登录
        </Link>
      }
    >
      {registered && !token && verifyEmailRequired !== false && (
        <Alert variant="success">注册成功，请完成邮箱验证。</Alert>
      )}
      {verifyEmailRequired === false && !token && (
        <Alert variant="default">邮箱验证不是必选项，请直接返回登录页。</Alert>
      )}
      {verifyEmailRequired !== false && status === "verifying" && <p className="text-sm text-slate-600">正在验证…</p>}
      {verifyEmailRequired !== false && status === "pending" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            我们已向 <strong>{email || "你的邮箱"}</strong> 发送验证链接。请查收邮件并点击链接完成验证。
          </p>
          {mailPending && (
            <Alert variant="default">邮件发送暂时失败，你可以稍后重新发送。</Alert>
          )}
          <Button
            className="h-11 bg-[#13234d] text-base hover:bg-[#1b326d]"
            type="button"
            onClick={resend}
            disabled={resending || !email}
          >
            {resending ? "发送中…" : "重新发送"}
          </Button>
        </div>
      )}
      {verifyEmailRequired !== false && status === "verified" && <Alert variant="success">{message}</Alert>}
      {verifyEmailRequired !== false && status === "error" && <Alert variant="destructive">{message}</Alert>}
      {verifyEmailRequired !== false && message && status === "pending" && <Alert>{message}</Alert>}
    </AuthPageShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="p-10 text-sm text-slate-600">加载中…</main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
