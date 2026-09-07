"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { FollowButton } from "@/components/community/engagement";
import { PageHero } from "@/components/community/page-primitives";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function MessageUserPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username || "");
  const { data: profile, loading, error } = useAsyncData(() => communityApi.getProfile(username), [username]);

  if (loading) {
    return <AppShell><main className="p-8 text-sm text-muted-foreground">加载中…</main></AppShell>;
  }

  if (error || !profile) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg p-8"><Alert variant="destructive">{error || "用户不存在"}</Alert></main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="xy-page max-w-lg">
        <PageHero variant="compact" title={profile.displayName || profile.username} description={profile.bio || undefined} />
        <div className="flex flex-wrap gap-3">
          <FollowButton username={profile.username!} initialFollowing={profile.following} />
          <Link href={`/messages/new?user=${profile.username}`} className="text-sm text-accent hover:underline">发私信</Link>
          <Link href={`/users/${profile.username}`} className="text-sm text-accent hover:underline">查看主页</Link>
        </div>
        <p className="text-sm text-muted-foreground">粉丝 {profile.followerCount ?? 0} · 关注 {profile.followingCount ?? 0}</p>
      </main>
    </AppShell>
  );
}
