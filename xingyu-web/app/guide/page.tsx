"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function GuidePage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getGuidePages(), []);
  const [query, setQuery] = useState("");
  const pages = useMemo(() => (data ?? []).filter((page) => `${page.title} ${page.summary || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [data, query]);
  return <AppShell><main className="xy-guide-home"><section className="xy-guide-hero"><div><span>星语社区指南</span><h1>使用指南</h1><div className="xy-guide-star-rule"><Sparkles /></div><h2>欢迎来到星语社区</h2><p>在这里查阅平台功能、创作与社区规则相关的官方说明。</p><form className="xy-guide-search" onSubmit={(event) => event.preventDefault()}><Search /><Input aria-label="搜索指南" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索指南、功能或问题…" /><Button type="submit">搜索</Button></form></div><Image src="/prototype-assets/guide-home/telescope.png" alt="" aria-hidden="true" width={615} height={380} priority /></section>{error ? <EmptyState title="指南加载失败" description={error} /> : null}{loading ? <p className="text-center text-sm text-muted-foreground">正在同步指南目录…</p> : null}{!loading && !error && !pages.length ? <EmptyState title="暂无匹配指南" description={query ? "尝试更换搜索关键词。" : "指南发布后会在这里展示。"} /> : null}{pages.length ? <section className="xy-guide-groups">{pages.map((page) => <article key={page.slug}><span><BookOpen /></span><h2>{page.title}</h2><p>{page.summary || "查看该指南的完整说明。"}</p><ul><li><Link href={`/guide/${encodeURIComponent(page.slug)}`}><i />查看指南详情<ArrowRight /></Link></li></ul></article>)}</section> : null}<footer className="xy-guide-support"><Sparkles /><p>没有找到答案？可通过 <Link href="/feedback/recommendations">推荐反馈</Link> 联系社区支持。</p><Button variant="outline" asChild><Link href="/feedback/recommendations">联系支持</Link></Button></footer></main></AppShell>;
}
