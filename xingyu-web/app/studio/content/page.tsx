"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, CircleCheck, FileText, PenLine, Sparkles, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type ArticleSummary } from "@/lib/community-api";

const labels: Record<string,string>={PUBLISHED:"已发布",DRAFT:"草稿",REVIEW:"审核中",REVIEWING:"审核中",RETURNED:"被退回"};

export default function ContentManagementPage(){
 const router=useRouter();const searchParams=useSearchParams();const [items,setItems]=useState<ArticleSummary[]>([]);const [filter,setFilter]=useState("ALL");const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [creating,setCreating]=useState(false);
 useEffect(()=>{communityApi.listMyArticles().then(setItems).catch(()=>setError("无法加载内容，请确认已登录")).finally(()=>setLoading(false))},[]);
 useEffect(()=>{const requested=searchParams.get("status")?.toUpperCase();setFilter(requested==="DRAFT"||requested==="REVIEWING"||requested==="RETURNED"||requested==="PUBLISHED"?requested:"ALL")},[searchParams]);
 async function create(){setCreating(true);try{const draft=await communityApi.createArticle();router.push(`/studio/articles/${draft.articleId}/edit`)}catch{setError("创建文章失败，请确认已登录");setCreating(false)}}
 const visible=useMemo(()=>filter==="ALL"?items:items.filter(item=>filter==="REVIEWING"?["REVIEW","REVIEWING"].includes(item.status):item.status===filter),[filter,items]);const counters=useMemo(()=>({published:items.filter(x=>x.status==="PUBLISHED").length,draft:items.filter(x=>x.status==="DRAFT").length,review:items.filter(x=>["REVIEW","REVIEWING"].includes(x.status)).length,returned:items.filter(x=>x.status==="RETURNED").length}),[items]);
 return <AppShell><main className="xy-content-management">{error&&<Alert variant="destructive">{error}</Alert>}<section className="xy-content-panel"><h1><Sparkles/> 内容管理</h1><nav aria-label="内容状态筛选">{[["ALL","全部内容",BookOpen],["DRAFT","草稿",FileText],["REVIEWING","审核中",CircleCheck],["RETURNED","被退回",XCircle]].map(([value,label,Icon])=>{const IconComponent=Icon as typeof BookOpen;return <button type="button" key={value as string} className={filter===value?"active":""} onClick={()=>setFilter(value as string)}><IconComponent/>{label as string}</button>})}</nav><div className="xy-content-table"><header><span>文章</span><span>最新编辑时间</span><span>状态</span><span>阅读</span><span>点赞</span><span>评论</span><span>操作</span></header>{loading?<p>正在加载内容…</p>:visible.length?visible.map((article,index)=>{const state=article.status;return <article key={article.id}><Link href={`/studio/articles/${article.id}/edit`}><Image src={`/prototype-assets/content-management/content-${(index%5)+1}.png`} alt="" aria-hidden="true" width={107} height={68}/><span><b>{article.title||"未命名文章"}</b><small>{article.summary||"文章摘要暂未提供"}</small></span></Link><time>{article.updatedAt?new Date(article.updatedAt).toLocaleString("zh-CN"):"更新时间暂未提供"}</time><em className={state.toLowerCase()}>{labels[state]||state}</em><span>暂未提供</span><span>暂未提供</span><span>暂未提供</span><Button variant="outline" size="sm" asChild><Link href={`/studio/articles/${article.id}/edit`}>编辑</Link></Button></article>}) : <p>暂无符合条件的内容</p>}</div><footer><span>共 {items.length} 篇内容</span></footer></section><aside className="xy-content-side"><Button className="xy-content-create" disabled={creating} onClick={()=>void create()}><PenLine/>{creating?"创建中…":"新建文章"}</Button><section className="xy-content-summary"><header><h2>创作总览</h2><Link href="/studio">查看全部 <ChevronRight/></Link></header><div><Metric value={counters.published} label="已发布"/><Metric value={counters.draft} label="草稿"/><Metric value={counters.review} label="审核中"/><Metric value={counters.returned} label="被退回"/></div></section><section className="xy-content-data"><h2>内容数据</h2><p>阅读、点赞、评论和分享统计将在接口提供后展示。</p></section><section className="xy-content-tip"><h2><Sparkles/> 创作小贴士</h2><p>持续记录真实思考，让内容逐渐形成自己的星系。</p></section></aside></main></AppShell>;
}
function Metric({value,label}:{value:number;label:string}){return <article><b>{value}</b><small>{label}</small></article>}
