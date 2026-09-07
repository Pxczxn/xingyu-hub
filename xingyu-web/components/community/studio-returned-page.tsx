"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, FileText, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi, type ReviewSubmissionDetail } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  RETURNED: "已退回",
  REJECTED: "已拒绝",
};

export function StudioReturnedPage() {
  const [submissions, setSubmissions] = useState<ReviewSubmissionDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .getMyReviewSubmissions(50)
      .then((items) =>
        setSubmissions(items.filter((item) => item.status === "RETURNED" || item.status === "REJECTED"))
      )
      .catch(() => setError("无法加载退回记录，请确认已登录"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <main className="xy-page max-w-5xl">
        <section className="xy-orbit-bg relative overflow-hidden rounded-[26px] border border-white/80 bg-white/72 p-6 shadow-[0_16px_42px_rgba(30,45,82,.08)] backdrop-blur-xl sm:p-8">
          <div className="relative z-10 flex items-start justify-between gap-5">
          <div>
            <p className="xy-kicker">创作空间 · 审核反馈</p>
            <h1 className="mt-2 text-[30px] font-bold tracking-[-.04em] text-[#152957] sm:text-[38px]">被退回的内容</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#68748b]">根据审核意见完成修改后，你可以从原稿继续编辑并重新提交。</p>
          </div>
          <Link href="/studio" className="shrink-0 rounded-full border border-[#e1e5ee] bg-white/70 px-4 py-2 text-sm text-[#4e6084] hover:bg-white">
            返回控制台
          </Link>
          </div>
          <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#f2d8bd] bg-[#fff8ee] p-4"><AlertTriangle className="h-5 w-5 text-[#dc8730]" /><b className="mt-3 block text-lg text-[#263963]">{loading ? "—" : submissions.length}</b><span className="text-xs text-[#7b8498]">待处理记录</span></div>
            <div className="rounded-2xl border border-[#dce4f5] bg-[#f6f8ff] p-4"><FileText className="h-5 w-5 text-[#5269b5]" /><b className="mt-3 block text-lg text-[#263963]">编辑原稿</b><span className="text-xs text-[#7b8498]">保留原有内容</span></div>
            <div className="rounded-2xl border border-[#dcecdf] bg-[#f5fbf6] p-4"><RotateCcw className="h-5 w-5 text-[#4d9a71]" /><b className="mt-3 block text-lg text-[#263963]">重新提交</b><span className="text-xs text-[#7b8498]">修改后继续审核</span></div>
          </div>
        </section>

        {error && <Alert variant="destructive" className="mt-6">{error}</Alert>}

        <Card className="mt-5 p-5 sm:p-6">
          <CardTitle>退回记录</CardTitle>
          <CardDescription className="mt-1">按最近提交时间排序</CardDescription>

          {loading ? (
            <p className="mt-8 rounded-2xl bg-[#f7f8fb] py-12 text-center text-sm text-muted-foreground">正在整理审核记录…</p>
          ) : submissions.length === 0 ? (
            <div className="mt-6 grid min-h-52 place-items-center rounded-2xl border border-dashed border-[#dfe4ee] bg-[#fafbfc] p-8 text-center"><div><RotateCcw className="mx-auto h-8 w-8 text-[#8090b9]" /><p className="mt-3 font-medium text-[#314367]">目前没有需要修改的投稿</p><p className="mt-1 text-sm text-muted-foreground">内容通过审核后，会从这里移出。</p></div></div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {submissions.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/studio/articles/${item.articleId}/edit`}
                    className="group flex flex-col gap-3 rounded-2xl border border-[#e5e8ef] bg-white/65 p-4 text-sm transition-all hover:-translate-y-0.5 hover:border-[#e0b27d] hover:bg-white hover:shadow-[0_10px_24px_rgba(58,70,108,.08)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.title || "无标题"}</p>
                      {item.decisionComment ? (
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{item.decisionComment}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.submittedAt)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0df] px-3 py-1.5 text-xs font-semibold text-[#b86b22]">{STATUS_LABEL[item.status] ?? item.status}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
