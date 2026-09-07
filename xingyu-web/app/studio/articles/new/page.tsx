"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";

export default function NewArticlePage() {
  const router = useRouter();

  useEffect(() => {
    communityApi
      .createArticle()
      .then((draft) => router.replace(`/studio/articles/${draft.articleId}/edit`))
      .catch(() => router.replace("/studio"));
  }, [router]);

  return (
    <CompactPageShell eyebrow="创作中心" title="新建文章" description="正在准备编辑器…" width="md">
      <Alert>正在创建新文章…</Alert>
    </CompactPageShell>
  );
}
