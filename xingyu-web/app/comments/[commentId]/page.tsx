"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ContentPageShell } from "@/components/community/content-page-shell";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function CommentDetailPage() {
  const params = useParams<{ commentId: string }>();
  const commentId = params.commentId;
  const { data: comment, loading, error } = useAsyncData(
    () => communityApi.getComment(commentId),
    [commentId]
  );

  if (loading) {
    return (
      <ContentPageShell width="md">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </ContentPageShell>
    );
  }

  if (error || !comment) {
    return (
      <ContentPageShell width="md">
        <EmptyState compact title="评论不存在" description={error || "该评论可能已被删除"} actionLabel="返回首页" actionHref="/" />
      </ContentPageShell>
    );
  }

  const author = comment.authorUsername ?? comment.authorId;
  const contentHrefValue = contentHref({ id: comment.objectId, objectType: comment.objectType });

  return (
    <ContentPageShell width="md">
      <PageHero variant="compact" eyebrow="评论" title="评论详情" />
      <Card>
        <CardDescription>
          <Link href={`/users/${author}`} className="hover:text-accent">@{author}</Link>
          <span className="mx-2">·</span>
          <time>{formatDateTime(comment.createdAt)}</time>
        </CardDescription>
        <p className="mt-4 text-sm leading-7">{comment.body}</p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={contentHrefValue}>查看原内容</Link>
          </Button>
        </div>
      </Card>
    </ContentPageShell>
  );
}
