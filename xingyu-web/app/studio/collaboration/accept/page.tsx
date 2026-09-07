"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi, type CollaborationInviteResolve } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [invite, setInvite] = useState<CollaborationInviteResolve | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("邀请链接无效");
      setLoading(false);
      return;
    }
    communityApi
      .resolveCollaborationInvite(token)
      .then((result) => {
        if (!result.valid) {
          setError("邀请已失效或不存在");
          return;
        }
        setInvite(result);
      })
      .catch(() => setError("无法验证邀请链接"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      await communityApi.acceptCollaborationInvite(token);
      setAccepted(true);
    } catch {
      setError("接受邀请失败，请确认已登录且链接仍有效");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">验证邀请中…</p>;
  }

  if (error || !invite?.valid) {
    return (
      <>
        <Alert variant="destructive">{error || "邀请无效"}</Alert>
        <Link href="/studio" className="mt-3 inline-block text-sm text-accent hover:underline">
          返回创作台
        </Link>
      </>
    );
  }

  if (accepted) {
    return (
      <Card>
        <CardTitle>已接受协作邀请</CardTitle>
        <CardDescription className="mt-2">
          你可以前往 @{invite.inviterUsername} 的创作空间查看协作内容。
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          {invite.inviterUsername && (
            <Button variant="accent" size="sm" onClick={() => router.push(`/users/${invite.inviterUsername}/works`)}>
              前往创作空间
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.push("/studio")}>
            返回创作台
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>协作邀请</CardTitle>
      <CardDescription className="mt-1">
        {invite.inviterDisplayName || invite.inviterUsername} 邀请你参与协作
      </CardDescription>
      <div className="mt-3 space-y-2 text-sm">
        {invite.note && <p className="text-muted-foreground">{invite.note}</p>}
        {invite.expiresAt && <p className="text-xs text-muted-foreground">有效期至 {formatDateTime(invite.expiresAt)}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="accent" disabled={accepting} onClick={() => void handleAccept()}>
          {accepting ? "处理中…" : "接受邀请"}
        </Button>
        {invite.inviterUsername && (
          <Button variant="outline" asChild>
            <Link href={`/users/${invite.inviterUsername}/works`}>先查看空间</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CollaborationAcceptPage() {
  return (
    <CompactPageShell eyebrow="创作中心" title="接受协作邀请" description="验证并确认协作邀请" width="sm" backHref="/studio/collaboration" backLabel="返回协作">
      <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
        <AcceptInviteContent />
      </Suspense>
    </CompactPageShell>
  );
}
