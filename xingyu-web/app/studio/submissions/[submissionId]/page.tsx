"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Award, Check, ChevronRight, FileCheck2, Lightbulb, PenLine, ShieldCheck, Sparkles, Star } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";


export default function ReviewSubmissionDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId = params.submissionId;
  const { data: submission, loading, error } = useAsyncData(
    () => communityApi.getMyReviewSubmission(submissionId),
    [submissionId]
  );
  const title = submission?.title || "未命名投稿";
  const submittedAt = submission?.submittedAt ? formatDateTime(submission.submittedAt) : "提交时间暂未提供";

  if (loading) return <AppShell><main className="xy-review-loading">正在加载审核详情…</main></AppShell>;
  if (error || !submission) return <AppShell><main className="xy-review-error"><Alert variant="destructive">{error || "投稿不存在或无权查看"}</Alert><Link href="/studio/reviewing">返回审核列表</Link></main></AppShell>;

  return <AppShell><main className="xy-review-detail">
    <div className="xy-review-crumb">创作中心 <ChevronRight/> <span>审核详情</span></div>
    <section className="xy-review-detail-main">
      <header className="xy-review-result"><div><i><Check/></i><span><h1>审核通过</h1><p>感谢你的用心创作，内容已符合社区规范</p></span></div><time>提交时间　{submittedAt}</time></header>
      <article className="xy-review-article"><Image src="/prototype-assets/review-detail/article-cover.png" alt="" aria-hidden="true" width={233} height={157}/><div><h2>{title}</h2><p>投稿摘要暂未提供</p><footer><PenLine/> 投稿内容 <b>•</b> 字数与配图信息暂未提供</footer></div></article>
      <section className="xy-review-process"><h2>审核流程</h2><p className="py-8 text-center text-sm text-slate-500">审核节点详情暂未由接口提供。</p></section>
      <footer className="xy-review-tip"><span><Lightbulb/> 温馨提示：优质内容更容易获得推荐，继续加油！</span><Link href="/guide">如何获得更多推荐？ <ChevronRight/></Link></footer>
    </section>
    <aside className="xy-review-detail-side">
      <section className="xy-review-feedback"><h2><Sparkles/> 审核反馈</h2><article><header><Image src="/prototype-assets/review-detail/reviewer-avatar.png" alt="" aria-hidden="true" width={42} height={42}/><span><b>审核信息</b><small>审核时间以接口返回为准</small></span></header><p>{submission.decisionComment || "审核意见暂未提供。"}</p></article></section>
      <section className="xy-review-next"><h2><Sparkles/> 接下来你可以</h2><ActionItem icon={<Star/>} title="查看作品" text="预览你的已发布内容" href={`/articles/${submission.articleId}`}/><ActionItem icon={<PenLine/>} title="继续创作" text="开启新的创作之旅" href="/studio/articles/new"/><ActionItem icon={<Award/>} title="创作中心" text="管理你的全部作品" href="/studio"/></section>
      <section className="xy-review-standards"><header><h2><FileCheck2/> 审核标准参考</h2><Link href="/guide">查看完整标准 <ChevronRight/></Link></header><p><span>内容价值</span><span>原创性</span><span>表达规范</span><span>社区友善</span></p></section>
    </aside>
  </main></AppShell>;
}

function ActionItem({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) {
  return <Link href={href}><i>{icon}</i><span><b>{title}</b><small>{text}</small></span><ArrowRight/></Link>;
}
