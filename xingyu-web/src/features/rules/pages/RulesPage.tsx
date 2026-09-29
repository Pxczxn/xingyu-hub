import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { PageState } from "@/components/shared/PageState";

type LoadState = { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; page: GuidePage };

export function RulesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    guideApi
      .getCommunityRules()
      .then((page) => {
        if (active) setState({ kind: "ready", page });
      })
      .catch(() => {
        if (active) setState({ kind: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "unavailable") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="社区规则暂不可用"
          description="请稍后重试，或先查看使用指南。"
        />
        <Link to="/guide" className="text-sm text-accent hover:underline">
          查看使用指南
        </Link>
      </div>
    );
  }

  const { page } = state;

  return (
    <article className="section-gap">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-xl font-semibold text-primary">{page.title}</h1>
        <Link to="/guide" className="text-sm text-accent hover:underline">
          查看使用指南
        </Link>
      </header>
      {page.publishedAt ? (
        <p className="text-sm text-muted-foreground">{formatPublishedAt(page.publishedAt)}</p>
      ) : null}
      <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{page.body}</div>
    </article>
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
