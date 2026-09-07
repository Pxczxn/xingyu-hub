"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, FileText, PenLine, Send, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSubmission, type EventSummary } from "@/lib/community-api";

const WORK_ARTS = ["work-1", "work-2", "work-3", "work-4"];

function toDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeLabel(value?: string) {
  const date = toDate(value);
  if (!date) return "时间待公布";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    SUBMITTED: "已投稿",
    PENDING: "审核中",
    APPROVED: "已通过",
    REJECTED: "未通过",
  };
  return labels[status] ?? status;
}

function countdown(end?: string) {
  const target = toDate(end);
  if (!target) return "结束时间待公布";
  const distance = target.getTime() - Date.now();
  if (distance <= 0) return "活动已结束";
  const totalHours = Math.floor(distance / 3_600_000);
  return `${Math.floor(totalHours / 24)} 天 ${String(totalHours % 24).padStart(2, "0")} 小时`;
}

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      communityApi.getEvent(eventId),
      communityApi.getEventSubmissions(eventId, 8).catch(() => []),
    ])
      .then(([detail, works]) => {
        setEvent(detail);
        setSubmissions(works);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [eventId]);

  const eventStatus = event?.submissionOpen ? "进行中" : "活动信息";
  const endCountdown = useMemo(() => countdown(event?.endsAt), [event?.endsAt]);

  if (loading) {
    return <AppShell><main className="xy-event-detail-real xy-event-detail-real-loading" aria-busy="true">正在加载活动详情…</main></AppShell>;
  }
  if (!event) {
    return (
      <AppShell>
        <main className="xy-event-detail-real xy-event-detail-real-missing" role="status">
          <Sparkles aria-hidden="true" />
          <h1>{failed ? "活动详情暂时无法加载" : "活动不存在"}</h1>
          <p>{failed ? "请稍后重试。" : "该活动可能已下线或链接已失效。"}</p>
          <Button asChild variant="outline"><Link href="/events">返回活动广场</Link></Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="xy-event-detail-real">
        <section className="xy-event-detail-real-hero" aria-labelledby="event-title">
          <Image src="/prototype-assets/activity-detail/hero-art.png" alt="" aria-hidden="true" width={637} height={262} priority />
          <div>
            <p><span>{eventStatus}</span> 社区活动</p>
            <h1 id="event-title">{event.title}</h1>
            <h2>{event.body ? "在星语，与同好一起完成这次探索。" : "活动说明将在详情页中持续更新。"}</h2>
            <footer>
              <b><CalendarClock /> {event.startsAt ? `开始：${dateTimeLabel(event.startsAt)}` : "开始时间待公布"}</b>
              <i aria-hidden="true" />
              <b><Clock3 /> {event.endsAt ? `距离结束 ${endCountdown}` : "结束时间待公布"}</b>
            </footer>
          </div>
          <Button asChild className="xy-event-detail-real-hero-action">
            <Link href={event.submissionOpen ? `/events/${encodeURIComponent(event.id)}/submit` : "/events"}>{event.submissionOpen ? "立即参与" : "返回活动广场"}</Link>
          </Button>
        </section>

        <div className="xy-event-detail-real-grid">
          <section className="xy-event-detail-real-main">
            <section className="xy-event-detail-real-panel xy-event-detail-real-description">
              <header><h2><FileText /> 活动说明</h2><span>{event.submissionOpen ? "投稿通道已开放" : "投稿通道暂未开放"}</span></header>
              <div>
                <article><Sparkles /><span><h3>活动内容</h3><p>{event.body || "主办方暂未提供详细说明。"}</p></span></article>
                <article><CalendarClock /><span><h3>开始时间</h3><p>{dateTimeLabel(event.startsAt)}</p></span></article>
                <article><Clock3 /><span><h3>结束时间</h3><p>{dateTimeLabel(event.endsAt)}</p></span></article>
                <article><CheckCircle2 /><span><h3>参与状态</h3><p>{event.submissionOpen ? "可提交已发布的文章、系列或动态。" : "当前活动暂未开放投稿。"}</p></span></article>
              </div>
            </section>

            <section className="xy-event-detail-real-panel xy-event-detail-real-flow">
              <header><h2><Send /> 参与方式</h2></header>
              <div>
                <article><b>1</b><span><h3>选择作品</h3><p>从自己已发布的内容中选择要参与活动的作品。</p>{event.submissionOpen ? <Button asChild variant="outline"><Link href={`/events/${encodeURIComponent(event.id)}/submit`}>去投稿</Link></Button> : null}</span></article>
                <article><b>2</b><span><h3>提交活动</h3><p>填写投稿说明后提交，活动方会记录本次参与。</p></span></article>
                <article><b>3</b><span><h3>查看状态</h3><p>投稿状态与已提交作品会显示在个人活动记录中。</p><Button asChild variant="outline"><Link href="/me/events">我的活动</Link></Button></span></article>
              </div>
            </section>

            <section className="xy-event-detail-real-panel xy-event-detail-real-works">
              <header><h2><PenLine /> 活动投稿</h2><span>{submissions.length ? `已展示 ${submissions.length} 项` : "暂未收到投稿"}</span></header>
              {submissions.length ? <div>{submissions.slice(0, 4).map((submission, index) => (
                <article key={submission.id}>
                  <Image src={`/prototype-assets/activity-detail/${WORK_ARTS[index % WORK_ARTS.length]}.png`} alt="" aria-hidden="true" width={198} height={166} />
                  <span><h3>{submission.objectTitle || "未命名作品"}</h3><b>{submission.objectType}</b><small>{statusLabel(submission.status)} · {dateTimeLabel(submission.createdAt)}</small></span>
                </article>
              ))}</div> : <p className="xy-event-detail-real-panel-empty">首个投稿会在这里展示。</p>}
            </section>
          </section>

          <aside className="xy-event-detail-real-side">
            <section className="xy-event-detail-real-panel xy-event-detail-real-submission-list">
              <header><h2><UsersRound /> 最新投稿</h2><span>{submissions.length} 项</span></header>
              {submissions.length ? submissions.slice(0, 5).map((submission, index) => <p key={submission.id}><i>{index + 1}</i><span><b>{submission.objectTitle || "未命名作品"}</b><small>{statusLabel(submission.status)}</small></span><strong>{submission.objectType}</strong></p>) : <p className="xy-event-detail-real-side-empty">暂无投稿记录</p>}
              {event.submissionOpen ? <Button asChild><Link href={`/events/${encodeURIComponent(event.id)}/submit`}>提交我的作品</Link></Button> : null}
            </section>
            <section className="xy-event-detail-real-panel xy-event-detail-real-meta">
              <header><h2><Sparkles /> 活动状态</h2></header>
              <p><b>投稿状态</b><span>{event.submissionOpen ? "开放中" : "未开放"}</span></p>
              <p><b>开始时间</b><span>{dateTimeLabel(event.startsAt)}</span></p>
              <p><b>结束时间</b><span>{dateTimeLabel(event.endsAt)}</span></p>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
