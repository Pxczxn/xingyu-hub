"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/community/auth-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function RegisterPendingAuditContent() {
  const params = useSearchParams();
  const registered = params.get("registered") === "1";

  return (
    <AuthPageShell
      eyebrow="注册已提交"
      title="等待管理员审核"
      description="你的注册申请已收到。管理员审核通过后即可使用邮箱或用户名登录社区。"
      footer={
        <Link href="/login" className="font-medium text-[#35457f] underline-offset-4 hover:underline">
          返回登录
        </Link>
      }
    >
      <div className="space-y-4">
        {registered && <Alert variant="success">注册成功，请等待审核。</Alert>}
        <Alert>审核通常会在 1–2 个工作日内完成，请耐心等待。</Alert>
        <Button asChild className="h-11 bg-[#13234d] text-base hover:bg-[#1b326d]">
          <Link href="/login">返回登录</Link>
        </Button>
      </div>
    </AuthPageShell>
  );
}

export default function RegisterPendingAuditPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#f8f7f3] text-sm text-slate-600">加载中…</main>}>
      <RegisterPendingAuditContent />
    </Suspense>
  );
}
