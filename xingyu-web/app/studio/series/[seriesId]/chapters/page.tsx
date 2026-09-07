"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  GripVertical,
  Trash2,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  communityApi,
  type ArticleSummary,
  type SeriesDetail,
} from "@/lib/community-api";

export default function SeriesChaptersPage() {
  const params = useParams<{ seriesId: string }>();
  const router = useRouter();
  const seriesId = params.seriesId;
  const lockVersion = useRef(0);
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    Promise.all([
      communityApi.getMySeries(seriesId),
      communityApi.listMyArticles(),
    ])
      .then(([detail, list]) => {
        setSeries(detail);
        lockVersion.current = detail.lockVersion ?? 0;
        setSelectedIds(detail.chapters.map((c) => c.articleId));
        setArticles(list);
      })
      .catch(() => setError("加载失败，请确认已登录且系列存在"))
      .finally(() => setLoading(false));
  }, [seriesId]);
  async function saveChapters() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await communityApi.updateSeries(seriesId, {
        chapterArticleIds: selectedIds,
        lockVersion: lockVersion.current,
      });
      lockVersion.current = updated.lockVersion ?? lockVersion.current + 1;
      setSuccess("章节顺序已保存");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem.detail || "保存失败"
          : "保存失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  }
  const selected = selectedIds.map(
    (id) =>
      articles.find((a) => a.id === id) ||
      ({
        id,
        title:
          series?.chapters.find((c) => c.articleId === id)?.title ||
          "未命名章节",
        status: "DRAFT",
      } as ArticleSummary),
  );
  function remove(id: string) {
    setSelectedIds((ids) => ids.filter((item) => item !== id));
  }
  return (
    <AppShell>
      <main className="xy-chapter-page mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
        {loading ? (
          <div className="rounded-3xl bg-white/70 p-12 text-center text-slate-500">
            正在载入章节…
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-[30px] border border-[#eee3d4] bg-white/78 p-7 shadow-[0_18px_48px_rgba(95,72,39,.08)] backdrop-blur-md lg:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm text-[#e8893c]">创作中心 / 系列</p>
                  <h1 className="mt-2 text-[32px] font-bold tracking-tight text-[#132957]">
                    系列章节管理
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    管理系列章节，调整顺序和发布状态
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => router.push(`/studio/series/${seriesId}/edit`)}
                  className="h-12 rounded-full bg-[#f18e39] px-6 text-white shadow-[0_8px_20px_rgba(236,133,47,.25)] hover:bg-[#df7c2a]"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  新建章节
                </Button>
              </div>
              <div className="mt-9 grid grid-cols-[1fr_120px_120px_180px_42px] gap-3 px-5 text-sm text-slate-500">
                <span>章节</span>
                <span>状态</span>
                <span>字数</span>
                <span>更新时间 ↕</span>
                <span />
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#eee6dc] bg-white">
                {selected.length ? (
                  selected.map((article, index) => (
                    <div
                      className="grid min-h-[92px] grid-cols-[1fr_120px_120px_180px_42px] items-center gap-3 border-b border-[#f1ece6] px-5 last:border-0"
                      key={article.id}
                    >
                      <div className="flex min-w-0 items-center">
                        <GripVertical className="mr-3 h-5 w-5 shrink-0 text-slate-300" />
                        <span className="mr-3 text-[#23355d]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#1d315e]">
                            {article.title || "未命名章节"}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-400">
                            在这里写下本章的内容与简介
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs ${article.status === "PUBLISHED" ? "bg-[#e7f5e8] text-[#4f9b5e]" : "bg-[#fff1df] text-[#e08a3d]"}`}
                      >
                        {article.status === "PUBLISHED" ? "已发布" : "草稿"}
                      </span>
                      <span className="text-sm text-[#29385d]">—</span>
                      <span className="text-sm text-slate-500">更新时间暂未提供</span>
                      <button
                        aria-label="移除章节"
                        onClick={() => remove(article.id)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-[#fff4e8] hover:text-[#e98438]"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    还没有章节，请先新建一篇文章。
                  </div>
                )}
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <GripVertical className="h-4 w-4" />
                拖拽左侧控制柄可调整章节顺序
              </p>
              {error && (
                <Alert variant="destructive" className="mt-4">
                  {error}
                </Alert>
              )}
              {success && <Alert className="mt-4">{success}</Alert>}
            </section>
            <aside className="rounded-[30px] border border-[#eee3d4] bg-white/78 p-6 shadow-[0_18px_48px_rgba(95,72,39,.08)] backdrop-blur-md">
              <h2 className="font-semibold text-[#1b2d56]">系列信息</h2>
              <img
                src="/prototype-assets/series-detail/series-cover.png"
                alt="系列封面"
                className="mt-4 h-[180px] w-full rounded-2xl object-cover"
              />
              <h3 className="mt-5 text-xl font-bold text-[#1a2d57]">
                {series?.title || "我的系列"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {series?.description ||
                  "在星辰与心语之间，记录那些微小却永恒的瞬间。"}
              </p>
              <Link
                href={`/studio/series/${seriesId}/edit`}
                className="mt-5 flex h-11 items-center justify-center rounded-xl border border-[#e9dfd4] text-sm text-[#26365e]"
              >
                编辑系列信息
              </Link>
              <div className="mt-6 border-t border-[#eee7de] pt-6">
                <p className="font-semibold text-[#27355a]">读者进度</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-24 w-24 place-items-center rounded-full border-[7px] border-[#f2a357] text-2xl font-bold text-[#1a2d57]">
                    —
                  </div>
                  <div className="text-sm text-slate-500">
                    读者平均进度
                    <b className="mt-1 block text-lg text-[#1d315f]">
                      {selected.length} / {Math.max(selected.length, 7)} 章
                    </b>
                    <span className="text-[#e68336]">读者进度数据暂未提供</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
        <div className="fixed bottom-5 left-1/2 z-30 flex w-[min(900px,calc(100%-40px))] -translate-x-1/2 justify-end gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_8px_30px_rgba(51,38,20,.15)] backdrop-blur-xl">
          <Link
            href={`/studio/series/${seriesId}/edit`}
            className="mr-auto inline-flex h-11 items-center gap-2 px-3 text-sm text-[#29385d]"
          >
            <BookOpen className="h-5 w-5" />
            编辑系列
          </Link>
          <Button
            type="button"
            onClick={() => void saveChapters()}
            disabled={submitting}
            className="h-11 bg-[#ee8c3d] px-6 text-white hover:bg-[#df7c30]"
          >
            {submitting ? "保存中…" : "保存排序"}
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
