"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { communityApi, type CollaborationInvite } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

export default function StudioCollaborationPage() {
  const [note, setNote] = useState("");
  const [invite, setInvite] = useState<CollaborationInvite | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = invite && typeof window !== "undefined"
    ? `${window.location.origin}${invite.inviteUrl}`
    : "";

  async function createInvite() {
    setCreating(true);
    setError(null);
    try {
      const created = await communityApi.createCollaborationInvite(note.trim() || undefined);
      setInvite(created);
    } catch {
      setError("创建邀请失败，请确认已登录");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <AppShell>
      <main className="xy-page max-w-2xl">
        <PageHero variant="compact" eyebrow="创作台" title="协作邀请" description="生成邀请链接，邀请协作者加入你的创作空间。" />
        <Card>
          <CardTitle>创建协作邀请</CardTitle>
          <CardDescription className="mt-1">邀请链接 7 天内有效</CardDescription>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="note">邀请备注（可选）</Label>
              <Input
                id="note"
                className="mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：欢迎一起审阅草稿"
              />
            </div>
            <Button disabled={creating} onClick={() => void createInvite()}>
              {creating ? "生成中…" : "生成邀请链接"}
            </Button>
            {error && <Alert variant="destructive">{error}</Alert>}
            {invite && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="break-all text-sm text-muted-foreground">{inviteUrl}</p>
                <p className="text-xs text-muted-foreground">有效期至 {formatDateTime(invite.expiresAt)}</p>
                <Button variant="outline" onClick={() => void copyLink()}>
                  {copied ? "已复制" : "复制链接"}
                </Button>
              </div>
            )}
          </div>
        </Card>
        <Link href="/studio" className="text-sm text-accent hover:underline">返回创作台</Link>
      </main>
    </AppShell>
  );
}
