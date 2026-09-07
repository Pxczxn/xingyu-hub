"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  FileText,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  communityApi,
  type EventSubmission,
  type EventSummary,
} from "@/lib/community-api";

function displayDate(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date)
    : "待公布";
}
function resultStatus(event?: EventSummary) {
  if (!event) return "待加载";
  const ends = event.endsAt ? new Date(event.endsAt).getTime() : Number.NaN;
  return !Number.isNaN(ends) && ends < Date.now()
    ? "待公布"
    : event.submissionOpen
      ? "进行中"
      : "待开放";
}

export default function ActivityResultsPage() {
  const routeEventId = useParams<{ eventId?: string }>().eventId;
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    communityApi
      .getEvents(20)
      .then((items) => {
        const requested = items.find((item) => item.id === routeEventId);
        const ended = items.find(
          (item) => item.endsAt && new Date(item.endsAt).getTime() < Date.now(),
        );
        setEvents(items);
        setActiveId(requested?.id ?? ended?.id ?? items[0]?.id ?? "");
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [routeEventId]);
  useEffect(() => {
    if (!activeId) {
      setSubmissions([]);
      return;
    }
    communityApi
      .getEventSubmissions(activeId, 50)
      .then(setSubmissions)
      .catch(() => setSubmissions([]));
  }, [activeId]);
  const event = events.find((item) => item.id === activeId);
  const contentTypes = useMemo(
    () => new Set(submissions.map((submission) => submission.objectType)).size,
    [submissions],
  );
  const nextEvent = events.find((item) => item.id !== activeId);
  return (
    <AppShell>
      <main className="xy-results-page">
        <section className="xy-results-main">
          <header>
            <h1>
              <Sparkles /> 活动结果
            </h1>
            <p>每一次参与，都会成为社区里的一束星光</p>
            <Image
              src="/prototype-assets/activity-results/result-hero.png"
              alt=""
              aria-hidden="true"
              width={656}
              height={321}
            />
          </header>
          <section className="xy-result-theme">
            <span>当前活动</span>
            <h2>{event?.title || (loading ? "正在加载活动" : "暂无活动")}</h2>
            <p>{event?.body || "活动说明将在这里展示。"}</p>
            <label>
              切换活动
              <select
                value={activeId}
                onChange={(change) => setActiveId(change.target.value)}
              >
                {events.length ? (
                  events.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))
                ) : (
                  <option value="">暂无活动</option>
                )}
              </select>
            </label>
          </section>
          <section className="xy-winner-show xy-result-pending">
            <article className="xy-winner">
              <div>
                <Image
                  src="/prototype-assets/activity-results/winner.png"
                  alt=""
                  aria-hidden="true"
                  width={395}
                  height={260}
                />
                <span>结果状态</span>
              </div>
              <section>
                <h2>
                  获奖结果
                  {resultStatus(event) === "待公布" ? "待公布" : "暂未开放"}
                </h2>
                <p>
                  当前接口尚未提供获奖名单、奖项或投票结果。活动方发布正式结果后，会在这里展示。
                </p>
                <h3>
                  <CalendarClock /> 活动结束：{displayDate(event?.endsAt)}
                </h3>
                {event ? (
                  <Button asChild variant="outline">
                    <Link href={`/events/${encodeURIComponent(event.id)}`}>
                      查看活动详情
                    </Link>
                  </Button>
                ) : null}
              </section>
            </article>
            <aside>
              <article>
                <Image
                  src="/prototype-assets/activity-results/second.png"
                  alt=""
                  aria-hidden="true"
                  width={196}
                  height={92}
                />
                <span>
                  <b>投稿记录</b>
                  <h3>{submissions.length} 项</h3>
                  <p>活动真实投稿数量</p>
                </span>
              </article>
              <article>
                <Image
                  src="/prototype-assets/activity-results/third.png"
                  alt=""
                  aria-hidden="true"
                  width={196}
                  height={91}
                />
                <span>
                  <b>内容类型</b>
                  <h3>{contentTypes} 种</h3>
                  <p>按已提交内容统计</p>
                </span>
              </article>
              {event ? (
                <Link href={`/events/${encodeURIComponent(event.id)}`}>
                  查看活动详情　›
                </Link>
              ) : null}
            </aside>
          </section>
          <section className="xy-result-lower">
            <article>
              <h2>
                <BarChart3 /> 数据回顾
              </h2>
              <div>
                <p>
                  <small>投稿作品</small>
                  <strong>{submissions.length} 项</strong>
                </p>
                <p>
                  <small>内容类型</small>
                  <strong>{contentTypes} 种</strong>
                </p>
                <p>
                  <small>投稿通道</small>
                  <strong>{event?.submissionOpen ? "开放中" : "未开放"}</strong>
                </p>
              </div>
              <small>
                活动时间：{displayDate(event?.startsAt)} —{" "}
                {displayDate(event?.endsAt)}
              </small>
            </article>
            <article>
              <h2>
                <MessageCircle /> 结果说明
              </h2>
              <p className="xy-results-empty-copy">
                评论、投票与获奖名单尚未由接口提供；页面不会展示示例评论或虚构互动数据。
              </p>
            </article>
            <article className="xy-next-event">
              <h2>
                <Sparkles /> 下一期活动
              </h2>
              <Image
                src="/prototype-assets/activity-results/next-event.png"
                alt=""
                aria-hidden="true"
                width={418}
                height={210}
              />
              <div>
                {nextEvent ? (
                  <>
                    <h3>{nextEvent.title}</h3>
                    <p>{nextEvent.body || "活动详情待发布。"}</p>
                    <Button asChild variant="outline">
                      <Link
                        href={`/events/${encodeURIComponent(nextEvent.id)}`}
                      >
                        查看活动
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p>
                    {failed
                      ? "活动列表暂时无法加载。"
                      : "下一期活动发布后会在这里展示。"}
                  </p>
                )}
              </div>
            </article>
          </section>
          <footer>
            {event
              ? "感谢每一位创作者的参与与分享。"
              : "星语社区期待与你一起创作。"}
          </footer>
        </section>
      </main>
    </AppShell>
  );
}
