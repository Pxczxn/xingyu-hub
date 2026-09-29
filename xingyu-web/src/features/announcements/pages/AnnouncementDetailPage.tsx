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
  return err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND");
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
        <PageState kind="empty" title="公告不存在或未发布" description="这条公告可能已归档，或地址有误。" />
        <BackToList />
      </div>
    );
  }

  const { item } = state;

  return (
    <article className="section-gap">
      <BackToList />
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-primary">{item.title}</h1>
        {item.publishedAt ? (
          <p className="text-sm text-muted-foreground">{formatPublishedAt(item.publishedAt)}</p>
        ) : null}
      </header>
      <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{item.body || "该公告暂未提供正文。"}</div>
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

