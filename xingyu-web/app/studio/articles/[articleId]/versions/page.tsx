"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  FileText,
  History,
  RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  communityApi,
  type ArticleDraft,
  type ArticleRevision,
} from "@/lib/community-api";

function stamp(value?: string) {
  return value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "时间暂未提供";
}
export default function ArticleVersionsPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const router = useRouter();
  const [revisions, setRevisions] = useState<ArticleRevision[]>([]);
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [active, setActive] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      communityApi.getArticleRevisions(articleId),
      communityApi.getArticleDraft(articleId),
    ])
      .then(([history, current]) => {
        setRevisions(history);
        setDraft(current);
        setActive(history[0]?.id || "");
      })
      .catch(() => setError("加载版本历史失败"))
      .finally(() => setLoading(false));
  }, [articleId]);
  const selected = useMemo(
    () => revisions.find((x) => x.id === active) || revisions[0],
    [active, revisions],
  );
  async function restore() {
    if (!selected || !confirm("确定将此版本恢复到当前草稿？")) return;
    setRestoring(selected.id);
    try {
      await communityApi.restoreArticleRevision(articleId, selected.id);
      router.push(`/studio/articles/${articleId}/edit`);
    } catch {
      setError("恢复版本失败");
    } finally {
      setRestoring(null);
    }
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-5 pb-12 pt-8 lg:px-8">
        <header>
          <h1 className="text-[32px] font-bold tracking-tight text-[#102856]">
            草稿恢复点
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            查看与恢复文章的历史版本，找回灵感的每一步
          </p>
        </header>
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
        {loading ? (
          <div className="mt-6 rounded-2xl border border-[#eee4d7] bg-white/80 p-16 text-center text-slate-400">
            正在读取草稿历史…
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <section className="overflow-hidden rounded-2xl border border-[#eee3d5] bg-white/80 shadow-[0_12px_35px_rgba(87,66,36,.06)]">
              <nav className="flex border-b border-[#eee6de] px-5">
                <span className="border-b-2 border-[#f18b37] px-4 py-5 text-sm font-semibold text-[#ec8532]">
                  自动保存
                </span>
              </nav>
              <p className="px-6 pt-5 text-sm text-slate-500">
                系统自动保存的草稿记录（最近 30 天）
              </p>
              <div className="px-6 py-4">
                {revisions.length ? (
                  revisions.map((revision, index) => (
                    <button
                      key={revision.id}
                      onClick={() => setActive(revision.id)}
                      className={`relative mb-3 w-full rounded-xl border p-4 text-left transition ${selected?.id === revision.id ? "border-[#ef9a4f] bg-[#fffaf4] shadow-sm" : "border-[#f0e9e0] bg-white hover:border-[#ebc49f]"}`}
                    >
                      <span
                        className={`absolute -left-[19px] top-6 h-3 w-3 rounded-full border-2 border-white ${index === 0 ? "bg-[#f68b31]" : "bg-[#e9a96b]"}`}
                      />
                      <div className="flex items-center justify-between">
                        <b className="text-sm text-[#1c315d]">
                          {stamp(revision.frozenAt)}
                        </b>
                        {index === 0 && (
                          <span className="rounded-full bg-[#fff0db] px-3 py-1 text-xs text-[#e98430]">
                            当前选中
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[#e9822b]">
                        {revision.visibility === "PUBLISHED"
                          ? "发布前版本"
                          : "自动保存"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {revision.summary ||
                          "保存了本次编辑的文章内容与设置信息"}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="py-16 text-center text-sm text-slate-400">
                    暂无可恢复版本
                  </div>
                )}
              </div>
              <footer className="flex items-center justify-between border-t border-[#eee7dd] px-6 py-4 text-xs text-slate-400">
                <span>自动保存每 3 分钟生成一次草稿版本</span>
                <Link
                  href={`/studio/articles/${articleId}/edit`}
                  className="text-[#4675ce]"
                >
                  返回编辑器
                </Link>
              </footer>
            </section>
            <section className="space-y-4">
              <div className="rounded-2xl border border-[#eee3d5] bg-white/85 p-6 shadow-[0_12px_35px_rgba(87,66,36,.06)]">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-[#1a2e59]">版本预览</h2>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    版本 ID：{selected?.id || "—"}
                  </span>
                </div>
                <article className="mt-4 min-h-[365px] rounded-xl border border-[#f0e9e0] bg-[#fffefd] p-7">
                  <h3 className="text-2xl font-bold text-[#152955]">
                    {selected?.title || draft?.title || "未命名文章"}
                  </h3>
                  <div className="mt-5 whitespace-pre-line text-[15px] leading-8 text-slate-600">
                    {draft?.body ||
                      selected?.summary ||
                      "当前版本尚未包含可供预览的正文内容。"}
                  </div>
                  <footer className="mt-8 flex flex-wrap gap-5 border-t border-[#eee6dc] pt-4 text-xs text-slate-400">
                    <span>字数 {draft?.body.length || 0}</span>
                    <span>版本 {selected?.revisionNumber || "—"}</span>
                    <span className="ml-auto">
                      保存于 {stamp(selected?.frozenAt)}
                    </span>
                  </footer>
                </article>
              </div>
              <div className="rounded-2xl border border-[#eee3d5] bg-white/85 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-[#1a2e59]">变更摘要</h2>
                  <span className="text-xs text-slate-400">对比上一版本</span>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-[#f0e9e0] px-5 py-8 text-center text-sm text-slate-400">
                  变更摘要由版本对比接口提供，当前暂无结构化差异数据。
                  {/* 版本差异列表由接口数据驱动 */}
                  {([] as string[]).map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-4 py-3 text-sm"
                    >
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full bg-slate-50"
                        style={{ color }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <b>{item}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
        <footer className="mx-auto mt-5 flex max-w-[720px] justify-end gap-3 rounded-2xl border border-[#eee3d5] bg-white/90 p-3 shadow-[0_10px_25px_rgba(86,63,31,.09)]">
          <Button
            disabled={!selected || Boolean(restoring)}
            onClick={() => void restore()}
            className="h-12 bg-[#f08c37] px-8 text-white hover:bg-[#e17f2d]"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restoring ? "恢复中…" : "恢复为当前草稿"}
          </Button>
        </footer>
        <p className="mt-4 text-center text-xs text-[#a68b75]">
          <Clock3 className="mr-1 inline h-3.5 w-3.5" />
          恢复后将覆盖当前草稿内容，建议先另存为副本以保留当前草稿。
        </p>
      </main>
    </AppShell>
  );
}
