"use client";

import Image from "next/image";
import Link from "next/link";
import { Award, CalendarClock, ChevronDown, FileText, Home, Medal, MessageCircle, PenLine, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSubmission, type EventSummary } from "@/lib/community-api";

const RAIL_ITEMS = [[Home, "首页", "/"], [Sparkles, "发现", "/discover"], [PenLine, "创作中心", "/studio"], [Trophy, "活动榜单", "/events/starry/rankings"], [MessageCircle, "话题", "/topics"]] as const;
function dateTime(value?: string) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "待公布"; }
function submissionStatus(status: string) { return ({ SUBMITTED: "已投稿", PENDING: "审核中", APPROVED: "已通过", REJECTED: "未通过" } as Record<string, string>)[status] ?? status; }

export default function ActivityRankingPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => { communityApi.getEvents(20).then((items) => { setEvents(items); setActiveId(items[0]?.id ?? ""); }).catch(() => setFailed(true)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!activeId) { setSubmissions([]); return; } communityApi.getEventSubmissions(activeId, 50).then(setSubmissions).catch(() => setSubmissions([])); }, [activeId]);
  const event = events.find((item) => item.id === activeId);
  const latestSubmissions = useMemo(() => [...submissions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [submissions]);
  return <AppShell><main className="xy-activity-rank">
    <aside className="xy-activity-rank-rail"><h2>星语社区<small>探索知识，连接同好</small></h2>{RAIL_ITEMS.map(([Icon, label, href]) => <Link className={label === "活动榜单" ? "active" : ""} href={href} key={label}><Icon />{label}</Link>)}<section><h3>活动与创作</h3><p>用作品参与社区活动，记录每一次灵感。</p><Button asChild><Link href={event?.submissionOpen ? `/events/${encodeURIComponent(event.id)}/submit` : "/events"}><PenLine /> 去投稿</Link></Button></section></aside>
    <section className="xy-activity-rank-main"><header><span><Sparkles /> 社区活动</span><h1>{event?.title || (loading ? "正在加载活动" : "活动榜单")}</h1><p>{event?.body || "榜单与活动投稿记录将在这里汇集。"}</p><small>活动时间：{dateTime(event?.startsAt)} — {dateTime(event?.endsAt)}</small><div><b>投稿状态</b><strong>{event?.submissionOpen ? "开放中" : "待开放"}</strong></div><Image src="/prototype-assets/activity-ranking/hero-trophy.png" alt="" aria-hidden="true" width={408} height={216}/></header>
      <section className="xy-podium xy-ranking-empty-podium" aria-label="榜单前三名"><div><Medal /><h2>榜单数据待发布</h2><p>当前接口尚未提供投票与评审排名，活动方发布后将在此展示前三名。</p></div></section>
      <section className="xy-ranking-table"><header><span>序号</span><span>投稿作品</span><span>内容类型</span><span>投稿状态</span><span>提交时间</span></header>{latestSubmissions.length ? latestSubmissions.map((submission, index) => <div key={submission.id}><b>{index + 1}</b><span><Image src={`/prototype-assets/activity-ranking/row-${(index % 3) + 1}.png`} alt="" aria-hidden="true" width={80} height={44}/>{submission.objectTitle || "未命名作品"}</span><span>{submission.objectType}</span><span>{submissionStatus(submission.status)}</span><em>{dateTime(submission.createdAt)}</em></div>) : <p className="xy-ranking-table-empty">{failed ? "活动信息暂时无法加载。" : loading ? "正在加载投稿记录…" : "暂未收到活动投稿。"}</p>}<Button variant="outline" disabled><ChevronDown /> 暂无更多记录</Button></section>
    </section>
    <aside className="xy-ranking-rules"><h2><Award /> 活动说明</h2><hr /><h3>活动内容</h3><p>{event?.body || "活动方暂未提供详细说明。"}</p><h3>时间安排</h3><p>开始：{dateTime(event?.startsAt)}<br />结束：{dateTime(event?.endsAt)}</p><h3>投稿通道</h3><p>{event?.submissionOpen ? "活动当前开放投稿，可从已发布内容中选择作品参与。" : "当前活动暂未开放投稿。"}</p><div className="xy-score-ring"><i /><span><b>—</b> 排名规则<br />等待活动方发布</span></div><h3>榜单状态</h3><p>投票、评审分数与排名数据尚未由接口提供，不在页面中展示估算或示例数值。</p>{event ? <Button variant="outline" asChild><Link href={`/events/${encodeURIComponent(event.id)}`}><FileText /> 查看活动详情</Link></Button> : null}</aside>
  </main></AppShell>;
}
