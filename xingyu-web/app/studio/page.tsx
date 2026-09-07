"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, FileText, Layers3, MessageCircle, PenLine, Plus, Send, Sparkles, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const statusLabel: Record<string, string> = { DRAFT: "草稿", PUBLISHED: "已发布", REVIEW: "审核中", REVIEWING: "审核中", RETURNED: "被退回" };

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return avatar ? <img src={avatar} alt={`${name} 的头像`} /> : <span>{name.slice(0, 1).toUpperCase()}</span>;
}

function WorkMark({ index }: { index: number }) { return <span className={`xy-studio-work-mark xy-studio-work-mark--${index % 4}`}><FileText /></span>; }

function QuickCreate({ icon, title, text, href, onClick }: { icon: React.ReactNode; title: string; text: string; href?: string; onClick?: () => void }) {
  const body = <><i>{icon}</i><span><b>{title}</b><small>{text}</small></span><ArrowRight /></>;
  return href ? <Link href={href}>{body}</Link> : <button type="button" onClick={onClick}>{body}</button>;
}

function StatusCard({ label, value, icon: Icon, description }: { label: string; value: number; icon: typeof FileText; description: string }) {
  return <article><span>{label}<Icon /></span><b>{value}</b><small>{description}</small></article>;
}

export default function StudioPage() {
  const router = useRouter();
  const [createError, setCreateError] = useState<string | null>(null);
  const profileState = useAsyncData(() => communityApi.getMyProfile(), []);
  const articlesState = useAsyncData(() => communityApi.listMyArticles(), []);
  const insightsState = useAsyncData(() => communityApi.getMyInsights(), []);
  const articles = articlesState.data ?? [];
  const profile = profileState.data;
  const insights = insightsState.data;
  const displayName = profile?.displayName || profile?.username || "星语者";
  const draft = articles.filter((article) => article.status === "DRAFT").length;
  const reviewing = articles.filter((article) => ["REVIEW", "REVIEWING"].includes(article.status)).length;
  const returned = articles.filter((article) => article.status === "RETURNED").length;
  const published = articles.filter((article) => article.status === "PUBLISHED").length;
  const recent = [...articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const error = createError || profileState.error || articlesState.error || insightsState.error;

  async function createArticle() {
    setCreateError(null);
    try { const created = await communityApi.createArticle(); router.push(`/studio/articles/${created.articleId}/edit`); }
    catch { setCreateError("创建文章失败，请确认登录状态后重试。"); }
  }

  return <AppShell><main className="xy-studio-real">
    {error ? <Alert variant="destructive">{error}</Alert> : null}
    <section className="xy-studio-real-hero">
      <div className="xy-studio-real-user"><Avatar name={displayName} avatar={profile?.avatar} /><span><h1>欢迎回来，{displayName}</h1><p>继续把正在思考的内容写下来。</p><small>创作空间会自动汇总你的文章状态与社区互动。</small></span><Button variant="outline" asChild><Link href={profile?.username ? `/users/${profile.username}` : "/me"}>个人主页</Link></Button></div>
      <aside><h2><Sparkles /> 创作小贴士</h2><p>完成草稿并提交审核后，内容才会进入公开阅读流程。</p><small>文章状态和互动数据均来自当前账号的真实记录。</small></aside>
    </section>
    <div className="xy-studio-real-layout"><section className="xy-studio-real-content">
      <section className="xy-studio-real-section xy-studio-real-quick"><h2>快速创建</h2><div><QuickCreate icon={<PenLine />} title="新建文章" text="撰写深度内容，记录你的思考" onClick={() => void createArticle()} /><QuickCreate icon={<MessageCircle />} title="新建动态" text="分享灵感、观点或即时想法" href="/studio/moments/new" /><QuickCreate icon={<Layers3 />} title="新建系列" text="组织连续内容，构建知识脉络" href="/studio/series/new" /></div></section>
      <div className="xy-studio-real-columns"><div>
        <section className="xy-studio-real-section xy-studio-real-overview"><h2>创作概览</h2><div><StatusCard label="草稿" value={draft} icon={FileText} description="可继续编辑" /><StatusCard label="审核中" value={reviewing} icon={Clock3} description="等待审核结果" /><StatusCard label="被退回" value={returned} icon={TriangleAlert} description="需要处理反馈" /><StatusCard label="已发布" value={published} icon={Send} description="已公开展示" /></div></section>
        <section className="xy-studio-real-section xy-studio-real-performance"><header><h2>创作数据</h2><Link href="/me/insights">查看详情 <ArrowRight /></Link></header><div>{insights ? <><DataStat label="已发布文章" value={insights.articleCount} icon={<BookOpen />} /><DataStat label="获得喜欢" value={insights.likeCount} icon={<CheckCircle2 />} /><DataStat label="收到评论" value={insights.commentCount} icon={<MessageCircle />} /><DataStat label="粉丝" value={insights.followerCount} icon={<Sparkles />} /></> : <p>正在加载创作数据…</p>}</div></section>
      </div>
      <section className="xy-studio-real-section xy-studio-real-recent"><header><h2>最近编辑</h2><Link href="/studio/content">全部作品 <ArrowRight /></Link></header>{articlesState.loading ? <p className="xy-studio-real-status">正在加载作品…</p> : null}{!articlesState.loading && recent.length ? <div>{recent.map((article, index) => <Link href={`/studio/articles/${encodeURIComponent(article.id)}/edit`} key={article.id}><WorkMark index={index} /><span><b>{article.title || "未命名文章"}</b><small>文章 · {statusLabel[article.status] || article.status}</small></span><time>{formatDateTime(article.updatedAt)}</time></Link>)}</div> : null}{!articlesState.loading && !recent.length ? <p className="xy-studio-real-status">还没有创作内容，从第一篇文章开始吧。</p> : null}</section>
      </div>
    </section>
    <aside className="xy-studio-real-side"><section><h2>待处理事项</h2><div className="xy-studio-real-pending"><TriangleAlert /><p>{returned ? `有 ${returned} 篇内容需要处理审核反馈` : "暂无需要处理的审核反馈"}</p><Link href="/studio/returned">查看</Link></div><div className="xy-studio-real-pending"><Clock3 /><p>{reviewing ? `${reviewing} 篇内容正在审核中` : "暂无审核中的内容"}</p><Link href="/studio/reviewing">查看</Link></div></section><section><h2>草稿箱快捷访问</h2><div className="xy-studio-real-drafts"><Link href="/studio/drafts"><FileText />文章草稿<b>{draft} 篇</b></Link><Link href="/studio/moments/new"><MessageCircle />发布动态<b>开始创作</b></Link><Link href="/studio/series"><Layers3 />系列管理<b>查看系列</b></Link></div></section></aside></div>
  </main></AppShell>;
}

function DataStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <article><i>{icon}</i><span>{label}</span><b>{value.toLocaleString()}</b><small>累计数据</small></article>; }
