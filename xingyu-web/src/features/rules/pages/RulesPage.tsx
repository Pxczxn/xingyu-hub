import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideOutline } from "@/api/guide/guide.types";
import { GuideBody } from "@/features/guide/components/GuideBody";
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
  // Built from the server's heading blocks. Empty when the document was written
  // without `## ` markers, in which case no index is shown — see GuideBody.
  const outline = guideOutline(page.blocks);

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

      {/*
        Two columns from : a clause index beside the document.
        This is the reason the body is now structured. A reader consults 社区规则
        by looking something up — 「违规处理是怎么规定的」 — and a 2000-word
        document with no index makes that a scroll-and-scan. The index is built
        from the server's heading blocks, so it lists real clauses rather than
        whatever a regex thought looked like a title.

        With no headings the outline renders nothing and the body keeps the full
        column, which is the same page as before.
      */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-10">
        <GuideBody blocks={page.blocks} body={page.body} />

        {outline.length > 0 ? (
          <nav
            aria-label="规则条款"
            className="rounded-xl border border-border/70 bg-card p-4 lg:sticky lg:top-24"
          >
            <p className="eyebrow mb-3">条款</p>
            <ul className="flex list-none flex-col gap-1.5 p-0">
              {outline.map((block) => (
                <li key={block.id}>
                  <a
                    href={`#${block.id}`}
                    className="focus-ring block rounded-sm text-meta leading-5 text-muted-foreground transition-colors hover:text-accent-strong"
                  >
                    {block.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
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
