import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; page: GuidePage };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

export function GuideDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!slug) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    guideApi
      .getBySlug(slug)
      .then((page) => {
        if (active) setState({ kind: "ready", page });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <BackToGuide />
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="指南不存在或未发布"
          description="这篇指南可能已下线，或地址有误。"
        />
        <BackToGuide />
      </div>
    );
  }

  const { page } = state;

  return (
    <article className="section-gap">
      <BackToGuide />
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-primary">{page.title}</h1>
        {page.publishedAt ? (
          <p className="text-sm text-muted-foreground">{formatPublishedAt(page.publishedAt)}</p>
        ) : null}
      </header>
      <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{page.body}</div>
    </article>
  );
}

function BackToGuide() {
  return (
    <Link to="/guide" className="text-sm text-accent hover:underline">
      返回指南目录
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
