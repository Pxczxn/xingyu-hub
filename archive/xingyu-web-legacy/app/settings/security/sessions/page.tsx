"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { communityApi, type SessionView } from "@/lib/community-api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await communityApi.listSessions();
      setSessions(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "无法加载会话");
      else setError("无法加载会话");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(sessionId: string) {
    try {
      await communityApi.revokeSession(sessionId);
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "撤销失败");
    }
  }

  async function revokeOthers() {
    try {
      await communityApi.revokeOtherSessions();
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.problem.detail || "撤销失败");
    }
  }

  return (
    <CompactPageShell
      eyebrow="账户"
      title="登录设备与会话"
      description="查看并管理当前账号的登录会话"
      width="md"
      backHref="/settings/security"
      backLabel="返回安全设置"
    >
      <Card>
        <CardTitle>活跃会话</CardTitle>
        {loading && <p className="mt-3 text-sm text-muted-foreground">加载中…</p>}
        {error && <Alert className="mt-3" variant="destructive">{error}</Alert>}
        {!loading && sessions && sessions.length === 0 && <p className="mt-3 text-sm text-muted-foreground">暂无其他设备会话。</p>}
        {!loading && sessions && sessions.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.sessionId} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {session.deviceLabel} {session.current && <span className="text-muted-foreground">（当前设备）</span>}
                  </p>
                  <p className="text-muted-foreground">最近活动：{new Date(session.lastActiveAt).toLocaleString()}</p>
                  {session.revoked && <p className="text-destructive">已撤销</p>}
                </div>
                {!session.revoked && !session.current && (
                  <Button type="button" variant="outline" size="sm" onClick={() => revoke(session.sessionId)}>
                    撤销
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="outline" size="sm" onClick={revokeOthers}>
            退出其他设备
          </Button>
          <Link href="/settings/security/email" className="self-center text-sm text-accent hover:underline">
            更换邮箱
          </Link>
        </div>
      </Card>
    </CompactPageShell>
  );
}
