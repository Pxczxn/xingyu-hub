"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { communityApi } from "@/lib/community-api";

export default function NewMessagePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await communityApi.openDirectConversation(username.trim());
      router.push(`/messages/direct/${conversation.id}`);
    } catch {
      setError("无法发起会话，请确认用户名正确且已登录");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Card>
          <CardTitle>发起私信</CardTitle>
          <CardDescription className="mt-2">输入对方用户名开始对话</CardDescription>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如 creator_name"
                required
              />
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "创建中…" : "开始对话"}
            </Button>
          </form>
        </Card>
      </main>
    </AppShell>
  );
}
