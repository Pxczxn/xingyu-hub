"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function canManageGroup(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

export default function GroupSettingsPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { data: conversation, loading, error, reload } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );
  const [title, setTitle] = useState("");
  const [joinMode, setJoinMode] = useState<"OPEN" | "APPROVAL">("OPEN");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canManage = canManageGroup(conversation?.myRole);
  const isOwner = conversation?.myRole === "OWNER";

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title || "");
      setJoinMode(conversation.joinMode === "APPROVAL" ? "APPROVAL" : "OPEN");
    }
  }, [conversation]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      const payload: { title?: string; joinMode?: "OPEN" | "APPROVAL" } = { title };
      if (isOwner) {
        payload.joinMode = joinMode;
      }
      await communityApi.updateGroupSettings(conversationId, payload);
      setMessage("群聊设置已保存");
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
          <h1 className="text-xl font-semibold">群聊设置</h1>
          <Link href={`/messages/group/${conversationId}`} className="text-sm text-accent hover:underline">
            返回聊天
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">{error}</Alert>
        ) : !canManage ? (
          <Alert>仅群主或管理员可修改群聊设置</Alert>
        ) : (
          <Card>
            <CardTitle>基本设置</CardTitle>
            <CardDescription className="mt-1">管理群名称与入群方式</CardDescription>
            <form className="mt-6 space-y-5" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="title">群名称</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={120}
                />
              </div>
              {isOwner && (
                <div className="space-y-2">
                  <Label>入群方式</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="joinMode"
                      checked={joinMode === "OPEN"}
                      onChange={() => setJoinMode("OPEN")}
                    />
                    开放加入（无需审批）
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="joinMode"
                      checked={joinMode === "APPROVAL"}
                      onChange={() => setJoinMode("APPROVAL")}
                    />
                    需要审批
                  </label>
                </div>
              )}
              {message && <Alert>{message}</Alert>}
              {saveError && <Alert variant="destructive">{saveError}</Alert>}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存设置"}</Button>
                <Link
                  href={`/messages/group/${conversationId}/members`}
                  className="inline-flex h-10 items-center text-sm text-accent hover:underline"
                >
                  成员管理
                </Link>
                <Link
                  href={`/messages/group/${conversationId}/applications`}
                  className="inline-flex h-10 items-center text-sm text-accent hover:underline"
                >
                  入群申请
                </Link>
              </div>
            </form>
          </Card>
        )}
      </main>
    </AppShell>
  );
}
