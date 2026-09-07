"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Plus, RefreshCw, Search } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi, type ArticleSummary, type TrashItem } from "@/lib/community-api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  IN_REVIEW: "审核中",
  TRASHED: "回收站",
};

type Props = {
  title: string;
  description: string;
  statusFilter?: string[];
  mode?: "articles" | "trash";
};

export function StudioArticleListPage({ title, description, statusFilter, mode = "articles" }: Props) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "trash") {
        setTrash(await communityApi.listMyTrash());
      } else {
        const all = await communityApi.listMyArticles();
        setArticles(statusFilter?.length ? all.filter((item) => statusFilter.includes(item.status)) : all);
      }
    } catch {
      setError("无法加载列表，请确认已登录");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [mode, statusFilter?.join(",")]);

  async function handleRestore(objectId: string) {
    setRestoringId(objectId);
    try {
      await communityApi.restoreArticle(objectId);
      await load();
    } catch {
      setError("恢复失败，请稍后重试");
    } finally {
      setRestoringId(null);
    }
  }

  const activeItems = mode === "trash" ? trash : articles;

  return (
    <CompactPageShell eyebrow="创作中心" title={title} description={description} width="xl" backHref="/studio" backLabel="返回控制台">
      {error && <Alert variant="destructive">{error}</Alert>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#f0dfca] bg-[#fff8ee] p-4"><FileText className="h-5 w-5 text-[#d9852e]" /><b className="mt-3 block text-xl text-[#253861]">{loading ? "—" : activeItems.length}</b><span className="text-xs text-[#7b8496]">当前页面内容</span></div>
        <div className="rounded-2xl border border-[#dce4f4] bg-[#f5f8ff] p-4"><Search className="h-5 w-5 text-[#5369b2]" /><b className="mt-3 block text-xl text-[#253861]">{mode === "trash" ? "可恢复" : "按状态"}</b><span className="text-xs text-[#7b8496]">快速定位你的内容</span></div>
        <div className="rounded-2xl border border-[#dcebdd] bg-[#f5fbf6] p-4"><RefreshCw className="h-5 w-5 text-[#4c9970]" /><b className="mt-3 block text-xl text-[#253861]">实时</b><span className="text-xs text-[#7b8496]">数据来自创作空间</span></div>
      </section>

      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{mode === "trash" ? "回收站" : "文章列表"}</CardTitle><CardDescription className="mt-1">{mode === "trash" ? "可恢复已删除的内容" : "选择内容继续编辑或查看审核状态"}</CardDescription></div>
          {mode === "articles" && <Button asChild className="rounded-full"><Link href="/studio/articles/new"><Plus className="mr-1.5 h-4 w-4" />新建文章</Link></Button>}
        </div>

        {loading ? (
          <p className="mt-8 rounded-2xl bg-[#f7f8fb] py-12 text-center text-sm text-muted-foreground">正在整理内容…</p>
        ) : mode === "trash" ? (
          trash.length === 0 ? (
            <div className="mt-6 grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#dfe4ee] bg-[#fafbfc] p-8 text-center"><div><FileText className="mx-auto h-8 w-8 text-[#8090b9]" /><p className="mt-3 font-medium text-[#314367]">回收站为空</p><p className="mt-1 text-sm text-muted-foreground">删除的内容会暂时保存在这里。</p></div></div>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {trash.map((item) => (
                <li
                  key={`${item.objectType}-${item.objectId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.title || item.objectType}</p>
                    <p className="text-xs text-muted-foreground">{item.objectId}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId === item.objectId}
                    onClick={() => void handleRestore(item.objectId)}
                  >
                    {restoringId === item.objectId ? "恢复中…" : "恢复"}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : articles.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无内容</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/studio/articles/${article.id}/edit`}
                  className="group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e5e8ef] bg-white/65 px-4 py-3.5 text-sm transition-all hover:-translate-y-0.5 hover:border-[#dcb17c] hover:bg-white hover:shadow-[0_10px_24px_rgba(58,70,108,.08)]"
                >
                  <span className="min-w-0"><span className="block truncate font-medium text-[#253861]">{article.title || "无标题"}</span><span className="mt-1 block text-xs text-[#8a93a5]">最后编辑于 {new Date(article.updatedAt).toLocaleDateString("zh-CN")}</span></span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{STATUS_LABEL[article.status] ?? article.status}</Badge>
                    <ArrowRight className="h-4 w-4 text-[#9aa4b6] transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </CompactPageShell>
  );
}
