"use client";

import { ChevronDown, FileText, Grid2X2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  communityApi,
  type EventSubmission,
  type EventSummary,
} from "@/lib/community-api";

const WORK_ARTS = [
  "work-1.png",
  "work-2.png",
  "work-3.png",
  "work-4.png",
  "work-5.png",
  "work-6.png",
];
function displayStatus(status: string) {
  return (
    (
      {
        SUBMITTED: "已投稿",
        PENDING: "审核中",
        APPROVED: "已通过",
        REJECTED: "未通过",
      } as Record<string, string>
    )[status] ?? status
  );
}
function displayDate(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date)
    : "时间待公布";
}

export default function EventWorksPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [activeEventId, setActiveEventId] = useState("");
  const [works, setWorks] = useState<EventSubmission[]>([]);
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    communityApi
      .getEvents(20)
      .then((items) => {
        setEvents(items);
        setActiveEventId(items[0]?.id ?? "");
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!activeEventId) {
      setWorks([]);
      return;
    }
    communityApi
      .getEventSubmissions(activeEventId, 50)
      .then(setWorks)
      .catch(() => setWorks([]));
  }, [activeEventId]);
  const activeEvent = events.find((event) => event.id === activeEventId);
  const types = useMemo(
    () => Array.from(new Set(works.map((work) => work.objectType))).sort(),
    [works],
  );
  const visibleWorks =
    type === "ALL" ? works : works.filter((work) => work.objectType === type);
  return (
    <AppShell>
      <main className="xy-event-works">
        <header className="xy-event-works-head">
          <div>
            <h1>
              活动作品 <Sparkles />
            </h1>
            <p>{activeEvent?.title || "社区活动作品展廊"}</p>
          </div>
        </header>
        <div className="xy-event-works-layout">
          <section className="xy-event-works-content">
            <div className="xy-works-hero-wrap">
              <Image
                className="xy-works-hero"
                src="/prototype-assets/event-works/event-hero.png"
                alt=""
                aria-hidden="true"
                width={926}
                height={199}
              />
              <div>
                <span>活动作品展廊</span>
                <h2>
                  {activeEvent?.title ||
                    (loading ? "正在加载活动" : "暂无活动")}
                </h2>
                {activeEvent?.body ? <p>{activeEvent.body}</p> : null}
              </div>
            </div>
            <nav className="xy-works-filter" aria-label="作品筛选">
              <button
                className={type === "ALL" ? "active" : ""}
                onClick={() => setType("ALL")}
              >
                全部作品
              </button>
              {types.map((item) => (
                <button
                  className={type === item ? "active" : ""}
                  onClick={() => setType(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
              <span />
              <label>
                选择活动
                <select
                  value={activeEventId}
                  onChange={(event) => setActiveEventId(event.target.value)}
                >
                  {events.length ? (
                    events.map((event) => (
                      <option value={event.id} key={event.id}>
                        {event.title}
                      </option>
                    ))
                  ) : (
                    <option value="">暂无活动</option>
                  )}
                </select>
                <ChevronDown />
              </label>
              <button type="button" disabled aria-label="当前为网格视图" aria-pressed="true">
                <Grid2X2 />
              </button>
            </nav>
            {visibleWorks.length ? (
              <div className="xy-works-masonry">
                {visibleWorks.map((work, index) => (
                  <article
                    className={`xy-work-card ${index % 3 === 0 ? "tall" : index % 3 === 1 ? "short" : "mid"}`}
                    key={work.id}
                  >
                    <div className="xy-work-cover">
                      <Image
                        src={`/prototype-assets/event-works/${WORK_ARTS[index % WORK_ARTS.length]}`}
                        alt=""
                        aria-hidden="true"
                        width={304}
                        height={214}
                      />
                      <i>
                        <FileText /> {displayStatus(work.status)}
                      </i>
                    </div>
                    <section>
                      <h2>{work.objectTitle || "未命名作品"}</h2>
                      <footer>
                        <span>
                          <b>{work.objectType.slice(0, 1)}</b>
                          {work.objectType}
                          <em>{displayDate(work.createdAt)}</em>
                        </span>
                      </footer>
                    </section>
                  </article>
                ))}
              </div>
            ) : (
              <section className="xy-event-works-empty" role="status">
                {failed
                  ? "活动列表暂时无法加载。"
                  : loading
                    ? "正在加载作品…"
                    : "这个活动暂时还没有可展示的投稿。"}
              </section>
            )}
          </section>
          <aside className="xy-event-works-side">
            <section className="xy-works-stats">
              <h2>
                <Sparkles /> 活动概览
              </h2>
              <dl>
                <div>
                  <dt>{works.length}</dt>
                  <dd>投稿作品</dd>
                </div>
                <div>
                  <dt>{types.length}</dt>
                  <dd>内容类型</dd>
                </div>
              </dl>
              {activeEvent ? (
                <Button asChild variant="outline">
                  <Link href={`/events/${encodeURIComponent(activeEvent.id)}`}>
                    查看活动详情
                  </Link>
                </Button>
              ) : null}
            </section>
            <section className="xy-works-authors">
              <header>
                <h2>投稿状态</h2>
              </header>
              {works.length ? (
                works.slice(0, 5).map((work, index) => (
                  <div key={work.id}>
                    <i>{index + 1}</i>
                    <b>{work.objectType.slice(0, 1)}</b>
                    <span>
                      <strong>{work.objectTitle || "未命名作品"}</strong>
                      <small>{displayStatus(work.status)}</small>
                    </span>
                    <em>{displayDate(work.createdAt)}</em>
                  </div>
                ))
              ) : (
                <p className="xy-event-works-side-empty">暂无投稿记录</p>
              )}
            </section>
            <section className="xy-works-rating">
              <Image
                src="/prototype-assets/event-works/rating-illustration.png"
                alt=""
                aria-hidden="true"
                width={313}
                height={213}
              />
              <div>
                <h2>参与活动</h2>
                <p>
                  {activeEvent?.submissionOpen
                    ? "投稿通道已开放，选择已发布内容即可参与。"
                    : "投稿状态将以活动详情页为准。"}
                </p>
                {activeEvent?.submissionOpen ? (
                  <Button asChild variant="outline">
                    <Link
                      href={`/events/${encodeURIComponent(activeEvent.id)}/submit`}
                    >
                      去投稿
                    </Link>
                  </Button>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
