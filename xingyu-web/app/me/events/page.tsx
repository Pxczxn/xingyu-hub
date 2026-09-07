"use client";

import { CalendarDays, ChevronRight, Clock3, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSubmission, type EventSummary } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

const visualSlots = ["ongoing-1.png", "ongoing-2.png", "waiting-1.png", "waiting-2.png", "completed-1.png", "completed-2.png", "completed-3.png"];

type SubmissionWithEvent = EventSubmission & { event?: EventSummary };

export default function MyEventsPage() {
  const { data, loading, error } = useAsyncData(async () => {
    const [submissions, events] = await Promise.all([communityApi.getMyEventSubmissions(), communityApi.getEvents()]);
    const byId = new Map(events.map((event) => [event.id, event]));
    return { events, submissions: submissions.map((submission) => ({ ...submission, event: byId.get(submission.eventId) })) };
  }, []);
  const submissions = data?.submissions ?? [];
  const active = submissions.filter((item) => item.event?.submissionOpen && !isCompleted(item.status));
  const completed = submissions.filter((item) => isCompleted(item.status));
  const waiting = submissions.filter((item) => !active.includes(item) && !completed.includes(item));
  const joined = new Set(submissions.map((item) => item.eventId));
  const recommendations = (data?.events ?? []).filter((event) => !joined.has(event.id)).slice(0, 5);

  return <AppShell><main className="xy-my-events"><section className="xy-my-events-main"><header className="xy-my-events-title"><h1>我的活动</h1><p>记录你的每一次参与，让热爱发光</p></header>
    <section className="xy-event-progress"><div><span>已参与活动</span><b>{submissions.length} <small>个</small></b><p>数据来自你的活动投稿记录</p></div><img src="/prototype-assets/my-events/summary-calendar.png" alt="" width={132} height={111}/><div className="xy-progress-line"><span>进行中的活动</span><b>{active.length}</b><i><em style={{width: submissions.length ? `${Math.round(active.length / submissions.length * 100)}%` : "0%"}}/></i><p>正在进行 {active.length} 项活动</p></div><Button variant="outline" asChild><Link href="/studio">创作中心 <ChevronRight/></Link></Button></section>
    {loading ? <p className="py-20 text-center text-slate-400">正在加载活动记录…</p> : error ? <EmptyState title="需要登录" description={error} actionLabel="去登录" actionHref="/login" /> : submissions.length === 0 ? <EmptyState title="还没有参与活动" description="参加社区活动后，你的投稿进度会显示在这里" actionLabel="浏览活动" actionHref="/events" /> : <><EventSection title={`进行中（${active.length}）`} icon={<Clock3/>}>{active.map((item, index) => <SubmissionCard item={item} image={visualSlots[index]} key={item.id} />)}</EventSection><EventSection title={`待处理（${waiting.length}）`} icon={<Clock3/>}>{waiting.map((item, index) => <SubmissionCard item={item} image={visualSlots[index + 2]} key={item.id} />)}</EventSection><EventSection title={`已完成（${completed.length}）`} icon={<Clock3/>} compact>{completed.map((item, index) => <CompletedCard item={item} image={visualSlots[index + 4]} key={item.id} />)}</EventSection><p className="xy-events-end">没有更多了</p></>}
  </section><aside className="xy-my-events-side"><header><h2><Sparkles/> 推荐活动</h2></header>{recommendations.length ? recommendations.map((event, index) => <article key={event.id}><img src={`/prototype-assets/my-events/recommend-${index % 2 + 1}.png`} alt="" width={106} height={143}/><section><h3>{event.title}</h3><p>{event.submissionOpen ? "征集进行中" : "暂未开放投稿"}</p><small><CalendarDays/> {event.startsAt || "时间待定"}<br/><span>活动</span> {event.endsAt || "结束时间待定"}</small><Button variant="outline" asChild><Link href={`/events/${encodeURIComponent(event.slug)}`}>查看活动</Link></Button></section></article>) : <p className="px-2 py-8 text-center text-sm text-slate-400">暂无可推荐活动</p>}<Button className="xy-events-more" variant="outline" asChild><Link href="/events">查看更多活动 <ChevronRight/></Link></Button></aside></main></AppShell>;
}

function isCompleted(status: string) { return ["APPROVED", "ACCEPTED", "COMPLETED", "PUBLISHED"].includes(status.toUpperCase()); }
function eventHref(item: SubmissionWithEvent) { return item.event ? `/events/${encodeURIComponent(item.event.slug)}` : "/events"; }
function SubmissionCard({ item, image }: { item: SubmissionWithEvent; image: string }) { const title = item.event?.title || item.objectTitle || "活动投稿"; return <article className="xy-event-wide-card"><div className="xy-event-image"><img src={`/prototype-assets/my-events/${image}`} alt="" width={213} height={214}/></div><section><h2>{title}<Star/></h2><small>{item.objectType} · 投稿</small><p>{item.note || "已提交活动作品，等待后续处理。"}</p><em>投稿状态：{item.status}</em><Button asChild><Link href={eventHref(item)}>查看活动</Link></Button></section></article>; }
function CompletedCard({ item, image }: { item: SubmissionWithEvent; image: string }) { return <article className="xy-event-complete"><img src={`/prototype-assets/my-events/${image}`} alt="" width={147} height={143}/><span><i>已完成</i><b>{item.event?.title || item.objectTitle || "活动投稿"}</b><small>状态：{item.status}</small><Button variant="outline" asChild><Link href={eventHref(item)}>查看活动</Link></Button></span></article>; }
function EventSection({title,icon,children,compact=false}:{title:string;icon:React.ReactNode;children:React.ReactNode;compact?:boolean}){if(!children || (Array.isArray(children)&&children.length===0))return null;return <section className={`xy-event-section ${compact?'compact':''}`}><h2>{icon}{title}</h2><div>{children}</div></section>}
