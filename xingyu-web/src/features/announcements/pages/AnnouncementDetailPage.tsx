import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; item: Announcement };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

export function AnnouncementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    announcementsApi
      .getById(id)
      .then((item) => {
        if (active) setState({ kind: "ready", item });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <BackToList />
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="公告不存在或未发布"
          description="这条公告可能已归档，或地址有误。"
        />
        <BackToList />
      </div>
    );
  }

  const { item } = state;

  return (
    /*
      A NOTICE, so it leads with what it is and when it takes effect.
      An announcement is not read the way an article is — the reader arrives
      asking "does this apply to me, and from when?". A badge states the document
      type, and the date sits in its own meta strip rather than as a loose line of
      grey text under the title, because for a notice the date is load-bearing.
    */
    <article className="section-gap">
      <BackToList />

      <header className="border-b border-border/70 pb-5">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-line/60 bg-accent-soft px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-strong">
          公告
        </span>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-primary">{item.title}</h1>
        {item.publishedAt ? (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-meta">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">发布</dt>
              <dd className="text-foreground-soft">
                <time dateTime={item.publishedAt}>{formatPublishedAt(item.publishedAt)}</time>
              </dd>
            </div>
          </dl>
        ) : null}
      </header>

      <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-8 text-foreground">
        {item.body || "该公告暂未提供正文。"}
      </div>
    </article>
  );
}

function BackToList() {
  return (
    <Link to="/announcements" className="text-sm text-accent hover:underline">
      返回公告列表
    </Link>
  );
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
