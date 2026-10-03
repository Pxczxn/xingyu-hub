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
    /*
      REFERENCE material, and typeset as such.
      This page, the guide detail and the announcement detail used to be the same
      three lines — back link, h1, date, plain body. They are three different
      reading jobs, so they now differ:
        rules        -> a canonical document; the reader looks something UP
        guide        -> a tutorial; the reader works THROUGH it
        announcement -> a notice; the reader checks whether it applies to them
      For rules that means an eyebrow, a meta bar that states what the document
      is and when it last changed, and a cross-link to the guide (the two
      documents are read together).
    */
    <article className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <p className="eyebrow mb-2.5">RULES</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{page.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
          <span>
            本页为社区规则的正式版本
            {page.publishedAt ? (
              <>
                ，最后更新于{" "}
                <time dateTime={page.publishedAt}>{formatPublishedAt(page.publishedAt)}</time>
              </>
            ) : null}
            。
          </span>
          <Link
            to="/guide"
            className="focus-ring rounded-sm font-medium text-accent-strong hover:underline"
          >
            查看使用指南
          </Link>
        </div>
      </header>

      {/* Reading measure, not full shell width. At 1200px a Chinese line runs
          ~70 glyphs, well past the 30-40 that reads comfortably; `68ch` is about
          34 CJK glyphs. Body copy also moves up a step for long-form reading. */}
      <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-8 text-foreground">
        {page.body}
      </div>
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
