"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function canManageGroup(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

export default function GroupAnnouncementPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { data: conversation, loading, error, reload } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );
  const [announcement, setAnnouncement] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (conversation) {
      setAnnouncement(conversation.announcement ?? "");
    }
  }, [conversation]);

  const editable = canManageGroup(conversation?.myRole);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editable) return;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      await communityApi.updateGroupAnnouncement(conversationId, announcement);
      setMessage("群公告已更新");
      reload();
    } catch (err) {
      if (err instanceof ApiError) setSaveError(err.problem.detail || "保存失败");
      else setSaveError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">群公告</h1>
          <Link href={`/messages/group/${conversationId}`} className="text-sm text-accent hover:underline">
            返回聊天
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">{error}</Alert>
        ) : (
          <Card>
            <CardTitle>{conversation?.title || "群聊"}</CardTitle>
            <CardDescription className="mt-1">
              {conversation?.announcementUpdatedAt
                ? `上次更新：${new Date(conversation.announcementUpdatedAt).toLocaleString()}`
                : "暂无群公告"}
            </CardDescription>
            {editable ? (
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <textarea
                  className="min-h-[140px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="输入群公告，留空可清除公告"
                  maxLength={2000}
                />
                {message && <Alert>{message}</Alert>}
                {saveError && <Alert variant="destructive">{saveError}</Alert>}
                <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存公告"}</Button>
              </form>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                {conversation?.announcement || "暂无群公告"}
              </p>
            )}
          </Card>
        )}
      </main>
    </AppShell>
  );
}
