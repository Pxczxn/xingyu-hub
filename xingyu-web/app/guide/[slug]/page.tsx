"use client";

import Link from "next/link";
import { FileText, Headphones, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function GuideDetailPage() {
  const { slug: raw } = useParams<{ slug: string }>();
  const slug = decodeURIComponent(raw || "");
  const { data: page, loading, error } = useAsyncData(() => communityApi.getGuidePage(slug), [slug]);
  const { data: pages } = useAsyncData(() => communityApi.getGuidePages(), []);
  if (loading) return <AppShell><main className="xy-guide-detail"><p>正在加载指南…</p></main></AppShell>;
  if (error || !page) return <AppShell><main className="xy-guide-detail"><Alert variant="destructive">{error || "指南页不存在"}</Alert></main></AppShell>;
  const paragraphs = (page.body || page.summary || "该指南暂未提供正文内容。").split(/\n{2,}|\n/).filter(Boolean);
  return <AppShell><main className="xy-guide-detail"><aside className="xy-guide-toc"><h2>本页内容</h2><a href="#guide-content" className="is-active">指南正文</a><hr /><Link href="/guide">全部指南</Link></aside><article className="xy-guide-article"><div className="xy-guide-breadcrumb"><Link href="/guide">使用指南</Link><span>›</span><b>{page.title}</b></div><header><div><h1>{page.title}</h1>{page.summary ? <p>{page.summary}</p> : null}</div></header><section id="guide-content" className="xy-guide-real-body">{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}</section><footer><div><span className="xy-guide-spark"><Sparkles /></span><p><b>继续探索星语</b><span>你可以在指南中心查看更多官方说明。</span></p></div><Button asChild><Link href="/guide">返回指南中心</Link></Button></footer></article><aside className="xy-guide-related"><section><h2>相关文章</h2>{(pages ?? []).filter((item) => item.slug !== slug).slice(0, 5).map((item) => <Link href={`/guide/${encodeURIComponent(item.slug)}`} key={item.id}><FileText />{item.title}</Link>)}</section><section><h2>仍有问题？</h2><p>可通过推荐反馈联系社区支持团队。</p><Button variant="outline" asChild><Link href="/feedback/recommendations"><Headphones className="mr-2 h-4 w-4" />联系支持团队</Link></Button></section></aside></main></AppShell>;
}
