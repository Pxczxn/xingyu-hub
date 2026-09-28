"use client";

import { FormEvent, useState } from "react";
import { MessageSquareOff, Send } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function RecommendationFeedbackPage() {
  const state = useAsyncData(() => communityApi.getRecommendationFeedback(), []);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!body.trim()) return;
    setSubmitting(true); setMessage(null);
    try { await communityApi.submitRecommendationFeedback(body.trim()); setBody(""); await state.reload(); setMessage("反馈已记录，后续推荐会参考你的选择。"); }
    catch { setMessage("提交失败，请确认登录状态后重试。"); }
    finally { setSubmitting(false); }
  }
  return <AppShell><main className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-8 lg:px-8">
    <header><p className="text-sm font-semibold text-[#df812f]">内容偏好</p><h1 className="mt-2 text-[2rem] font-bold text-[#142957]">减少推荐记录</h1><p className="mt-2 text-sm leading-6 text-[#718096]">告诉星语哪些内容不适合你，这不是举报或屏蔽。</p></header>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-2xl border border-[#e8e2da] bg-white/75"><h2 className="border-b border-[#ece6df] px-6 py-4 text-lg font-semibold text-[#263960]">历史反馈</h2>{state.loading ? <p className="py-16 text-center text-sm text-[#7b8698]">正在加载…</p> : state.error ? <Alert variant="destructive" className="m-5">{state.error}</Alert> : state.data?.length ? <ul className="divide-y divide-[#eee7df]">{state.data.map((item) => <li className="px-6 py-4" key={item.id}><p className="text-sm leading-6 text-[#344565]">{item.body}</p><small className="mt-2 block text-xs text-[#8a93a2]">{item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "提交时间暂未提供"}</small></li>)}</ul> : <EmptyState icon={MessageSquareOff} title="暂无减少推荐记录" description="提交后可以在这里查看已记录的偏好" />}</section>
      <form onSubmit={submit} className="rounded-2xl border border-[#e8e2da] bg-white/75 p-6"><h2 className="text-lg font-semibold text-[#263960]">提交反馈</h2><label className="mt-5 block text-sm font-medium text-[#40506e]">希望减少哪些内容<textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#e5ddd3] bg-white p-3 text-sm leading-6 outline-none focus:border-[#d69a58]" placeholder="例如：减少重复出现的入门教程" /></label>{message && <Alert className="mt-4">{message}</Alert>}<Button className="mt-5 w-full" disabled={submitting || !body.trim()}><Send className="mr-2 h-4 w-4"/>{submitting ? "提交中…" : "提交反馈"}</Button></form>
    </div>
  </main></AppShell>;
}
