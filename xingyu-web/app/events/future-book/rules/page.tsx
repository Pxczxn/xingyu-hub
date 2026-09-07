"use client";

import Image from "next/image";
import Link from "next/link";
import { Award, Bell, BookOpen, CalendarDays, CheckCircle2, FileText, Home, MessageSquareText, PenLine, ShieldCheck, Sparkles, Star, Trophy, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSummary } from "@/lib/community-api";

const RAIL = [[Home, "首页", "/"], [Star, "发现", "/discover"], [MessageSquareText, "话题", "/topics"], [FileText, "系列", "/series"], [Award, "活动", "/events"], [Trophy, "榜单", "/events/starry/rankings"], [PenLine, "创作中心", "/studio"], [Bell, "通知", "/notifications"], [BookOpen, "书架", "/me/bookshelf"]] as const;
function formatDate(value?: string) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "待公布"; }

export default function ActivityRulesPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { communityApi.getEvents(20).then((items) => { setEvents(items); setActiveId(items[0]?.id ?? ""); }).catch(() => setEvents([])).finally(() => setLoading(false)); }, []);
  const event = events.find((item) => item.id === activeId);
  return <AppShell><main className="xy-rules-page">
    <aside className="xy-rules-rail"><h2>星语社区<small>与思想相遇，与星辰同行</small></h2><nav>{RAIL.map(([Icon, label, href]) => <Link className={label === "活动" ? "active" : ""} href={href} key={label}><Icon />{label}</Link>)}</nav><section><p>活动与创作</p><small>活动说明会随着官方发布持续更新。</small><div><b>{events.length}<small>活动</small></b><b>{event?.submissionOpen ? "开放" : "待定"}<small>投稿</small></b></div></section><Button asChild><Link href="/studio"><PenLine /> 发布创作</Link></Button></aside>
    <section className="xy-rules-content"><section className="xy-rules-hero"><div><span>社区活动说明</span><h1>{event?.title || (loading ? "正在加载活动" : "活动规则")}</h1><h2>{event?.body || "活动说明与参与方式将在这里展示。"}</h2><footer><CalendarDays /> {formatDate(event?.startsAt)} — {formatDate(event?.endsAt)}　<Trophy /> 投稿：{event?.submissionOpen ? "开放中" : "暂未开放"}</footer></div><Image src="/prototype-assets/activity-rules/hero-art.png" alt="" aria-hidden="true" width={518} height={288} priority /></section>
      <section className="xy-rules-timeline" id="timeline"><h2><em>01</em> 活动时间线</h2><div><article><i><CalendarDays /></i><h3>活动开始</h3><b>{formatDate(event?.startsAt)}</b><small>活动开始时间</small></article><article><i><PenLine /></i><h3>投稿状态</h3><b>{event?.submissionOpen ? "开放中" : "暂未开放"}</b><small>以活动详情状态为准</small></article><article><i><FileText /></i><h3>活动结束</h3><b>{formatDate(event?.endsAt)}</b><small>活动结束时间</small></article><article><i><Award /></i><h3>结果发布</h3><b>待活动方公告</b><small>当前未提供结果时间</small></article></div></section>
      <div className="xy-rules-pair"><section id="conditions"><h2><em>02</em> 参与条件</h2><div className="xy-condition-row"><article><UserRound /><h3>已登录账号</h3><p>需要使用自己的星语社区账号参与活动。</p></article><article><PenLine /><h3>已发布内容</h3><p>从自己已发布的文章、系列或动态中选择作品。</p></article><article><ShieldCheck /><h3>遵守社区规范</h3><p>投稿内容需符合星语社区规范与活动说明。</p></article></div></section><section id="submission"><h2><em>03</em> 投稿规范</h2><p><b>投稿方式</b>在活动投稿页选择已发布内容后提交。</p><p><b>活动说明</b>{event?.body || "活动方暂未提供额外说明。"}</p><p><b>投稿状态</b>{event?.submissionOpen ? "当前可提交投稿。" : "当前活动暂未开放投稿。"}</p><p><b>内容范围</b>作品类型与活动页面实际支持的范围为准。</p></section></div>
      <div className="xy-rules-pair"><section id="review"><h2><em>04</em> 审核与结果</h2><div className="xy-condition-row"><article><FileText /><h3>提交记录</h3><p>投稿成功后会出现在个人活动记录中。</p></article><article><CheckCircle2 /><h3>状态更新</h3><p>审核状态以活动详情和个人活动页面显示为准。</p></article><article><Sparkles /><h3>结果公布</h3><p>获奖和评审结果将在活动方发布后展示。</p></article></div></section><section id="awards"><h2><em>05</em> 奖项说明</h2><div className="xy-award-row"><article><Award /><h3>奖项信息</h3><b>待发布</b><small>当前接口未提供奖项设置</small></article><article><Trophy /><h3>评选规则</h3><b>待发布</b><small>当前接口未提供评审维度</small></article><article><Star /><h3>活动奖励</h3><b>待发布</b><small>以官方活动公告为准</small></article></div></section></div>
    </section>
    <aside className="xy-rules-side"><section><h2>目录导航</h2>{[["01　活动时间线", "timeline"], ["02　参与条件", "conditions"], ["03　投稿规范", "submission"], ["04　审核与结果", "review"], ["05　奖项说明", "awards"]].map(([label, id], index) => <a className={index === 0 ? "active" : ""} href={`#${id}`} key={id}>{label}</a>)}</section><section><Image src="/prototype-assets/activity-rules/question-art.png" alt="" aria-hidden="true" width={94} height={96}/><h2>活动说明</h2><p>活动相关问题和平台规则可在指南中查看。</p><Button asChild><Link href="/guide">查看指南</Link></Button></section>{event?.submissionOpen ? <Button asChild><Link href={`/events/${encodeURIComponent(event.id)}/submit`}>前往投稿</Link></Button> : null}</aside>
  </main></AppShell>;
}
