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
    /*
      A TUTORIAL, so it has a beginning and an end.
      The back link moves ABOVE the header into a proper step-back affordance, and
      the page closes with a way to continue — a guide that just stops leaves the
      reader at a dead end. The footer points at the guide index rather than a
      "next guide", because this contract has no sibling ordering: inventing a
      next-slug would produce a link to a page that may not exist.
    */
    <article className="section-gap">
      <BackToGuide />

      <header className="border-b border-border/70 pb-5">
        <p className="eyebrow mb-2.5">GUIDE</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{page.title}</h1>
        {page.publishedAt ? (
          <p className="mt-2 text-meta text-muted-foreground">
            发布于 <time dateTime={page.publishedAt}>{formatPublishedAt(page.publishedAt)}</time>
          </p>
        ) : null}
      </header>

      <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-8 text-foreground">
        {page.body}
      </div>

      <footer className="max-w-[68ch] border-t border-border/70 pt-5">
        <Link
          to="/guide"
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-meta font-medium text-foreground transition-colors hover:bg-surface-sunken"
        >
          返回指南列表，继续下一篇
        </Link>
      </footer>
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
