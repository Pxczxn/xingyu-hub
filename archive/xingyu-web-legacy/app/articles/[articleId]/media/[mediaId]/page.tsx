"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContentPageShell } from "@/components/community/content-page-shell";
import { PageHero } from "@/components/community/page-primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { findArticleMedia } from "@/lib/article-media";

export default function ArticleMediaPage() {
  const params = useParams<{ articleId: string; mediaId: string }>();
  const articleId = params.articleId;
  const mediaId = params.mediaId;
  const [url, setUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi
      .getArticle(articleId)
      .then((article) => {
        const media = findArticleMedia(article.body ?? "", mediaId);
        if (!media) {
          setError("未找到对应媒体");
          return;
        }
        setUrl(media.url);
        setAlt(media.alt ?? article.title);
      })
      .catch(() => setError("加载失败"));
  }, [articleId, mediaId]);

  return (
    <ContentPageShell width="xl">
      <PageHero
        variant="compact"
        eyebrow="文章"
        title="文章媒体"
        actions={
          <Link href={`/articles/${articleId}`} className="text-sm text-accent hover:underline">
            返回文章
          </Link>
        }
      />
      {error ? (
        <Alert variant="destructive">{error}</Alert>
      ) : !url ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            <Image
              src={url}
              alt={alt ?? "文章图片"}
              width={1200}
              height={800}
              unoptimized
              className="mx-auto h-auto max-h-[70vh] w-full object-contain"
            />
          </div>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">在新窗口打开</a>
          </Button>
        </div>
      )}
    </ContentPageShell>
  );
}
