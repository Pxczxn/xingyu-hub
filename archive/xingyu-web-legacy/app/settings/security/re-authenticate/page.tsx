"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { setStoredRecentAuth } from "@/lib/recent-auth";

function ReAuthenticateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/settings/security";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await communityApi.reAuthenticate(password);
      const expiresAt = result.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();
      setStoredRecentAuth(result.recentAuthId, expiresAt);
      setSuccess("身份验证成功，15 分钟内可进行敏感操作。");
      setTimeout(() => router.push(returnTo), 800);
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || err.problem.title);
      else setError("验证失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CompactPageShell eyebrow="账户" title="验证身份" description="敏感操作前需确认当前密码" width="sm" backHref="/settings/security" backLabel="返回安全设置">
      <Card>
        <CardTitle>身份验证</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">请输入当前密码以继续敏感操作。</p>
        <form className="mt-4 flex flex-col gap-3.5" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="password">当前密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
              disabled={submitting}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "验证中…" : "确认"}
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          验证成功后将返回：
          <Link href={returnTo} className="ml-1 text-accent hover:underline">
            继续操作
          </Link>
        </p>
      </Card>
    </CompactPageShell>
  );
}

export default function ReAuthenticatePage() {
  return (
    <Suspense
      fallback={
        <CompactPageShell eyebrow="账户" title="验证身份" width="sm">
          <p className="text-sm text-muted-foreground">加载中…</p>
        </CompactPageShell>
      }
    >
      <ReAuthenticateForm />
    </Suspense>
  );
}
