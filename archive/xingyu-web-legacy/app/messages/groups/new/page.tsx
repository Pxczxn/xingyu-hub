"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { communityApi } from "@/lib/community-api";

export default function NewGroupPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await communityApi.createGroupConversation(title.trim());
      router.push(`/messages/group/${conversation.id}`);
    } catch {
      setError("无法创建群聊，请确认已登录");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Card>
          <CardTitle>创建群聊</CardTitle>
          <CardDescription className="mt-2">为你的创作小组或读者群起一个名字</CardDescription>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="title">群名称</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如 星语写作小组"
                required
              />
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "创建中…" : "创建群聊"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/?openMessages=1">取消</Link>
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </AppShell>
  );
}
