"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function GroupJoinPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: conversation, loading } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.submitGroupJoinRequest(conversationId, message.trim() || undefined);
      setSuccess(true);
      setTimeout(() => router.push(`/messages/group/${conversationId}`), 1500);
    } catch {
      setError("提交失败，请确认已登录且符合入群条件");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="px-4 py-8 text-sm text-muted-foreground sm:px-6">加载中…</main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Card>
          <CardTitle>申请加入群聊</CardTitle>
          <CardDescription className="mt-1">
            {conversation?.title || "群聊"}
            {conversation?.joinMode === "APPROVAL" ? " · 需要管理员审批" : " · 开放加入"}
          </CardDescription>

          {success ? (
            <Alert className="mt-6">申请已提交</Alert>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div>
                <Label htmlFor="message">申请留言（可选）</Label>
                <textarea
                  id="message"
                  className="mt-1 min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="简单介绍一下自己…"
                />
              </div>
              {error && <Alert variant="destructive">{error}</Alert>}
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "提交中…" : "提交申请"}
                </Button>
                <Link href={`/messages/group/${conversationId}`} className="inline-flex items-center text-sm text-accent hover:underline">
                  返回
                </Link>
              </div>
            </form>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
