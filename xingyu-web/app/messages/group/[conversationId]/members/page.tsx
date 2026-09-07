"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function canManageGroup(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

export default function GroupMembersPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const { data: conversation } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );
  const { data: profile } = useAsyncData(() => communityApi.getMyProfile(), []);
  const { data: members, loading, error, reload } = useAsyncData(
    () => communityApi.getGroupMembers(conversationId),
    [conversationId]
  );

  const myRole = conversation?.myRole;
  const canManage = canManageGroup(myRole);
  const isOwner = myRole === "OWNER";

  async function handleKick(userId: string) {
    if (!confirm("确定移除此成员？")) return;
    setActingUserId(userId);
    setActionError(null);
    try {
      await communityApi.removeGroupMember(conversationId, userId);
      reload();
    } catch {
      setActionError("移除成员失败");
    } finally {
      setActingUserId(null);
    }
  }

  async function handleLeave() {
    if (!confirm("确定退出此群聊？")) return;
    setLeaving(true);
    setActionError(null);
    try {
      await communityApi.leaveGroup(conversationId);
      router.push("/?openMessages=1");
    } catch {
      setActionError("退出群聊失败");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">群成员</h1>
          <Link href={`/messages/group/${conversationId}`} className="text-sm text-accent hover:underline">返回聊天</Link>
        </div>

        {!isOwner && (
          <div className="mb-4">
            <Button variant="outline" size="sm" disabled={leaving} onClick={() => void handleLeave()}>
              {leaving ? "处理中…" : "退出群聊"}
            </Button>
          </div>
        )}

        {actionError && <Alert variant="destructive" className="mb-4">{actionError}</Alert>}

        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">{error}</Alert>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {(members ?? []).map((member) => {
              const isSelf = member.username === profile?.username;
              const canKick = canManage && member.role !== "OWNER" && !isSelf;
              return (
                <li key={member.userId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/users/${member.username}`} className="font-medium hover:text-[rgb(var(--violet))]">
                      {member.displayName || member.username}
                      {isSelf ? "（我）" : ""}
                    </Link>
                    <p className="text-muted-foreground">{member.role}</p>
                  </div>
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actingUserId === member.userId}
                      onClick={() => void handleKick(member.userId)}
                    >
                      {actingUserId === member.userId ? "处理中…" : "移除"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
