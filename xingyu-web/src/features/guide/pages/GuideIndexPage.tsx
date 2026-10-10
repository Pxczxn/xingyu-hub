import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { PageState } from "@/components/shared/PageState";

const GUIDE_ENTRIES = [
  {
    slug: "getting-started",
    title: "快速上手",
    description: "了解浏览、创作和参与社区的基本路径。",
    href: "/guide/getting-started",
  },
  {
    slug: "community-rules",
    title: "社区规则",
    description: "了解社区规范，以及举报与申诉相关规则。",
    href: "/rules",
  },
] as const;

export function GuideIndexPage() {
  const [pages, setPages] = useState<GuidePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    guideApi
      .list()
      .then((data) => {
        if (!active) return;
        setPages(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <p className="eyebrow mb-2.5">GUIDE</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">使用指南</h1>
        <p className="mt-2.5 max-w-xl text-sm leading-6 text-muted-foreground">
          从第一次进入星语，到找到自己的创作与交流方式。
        </p>
      </header>

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && pages.length === 0 ? (
        <PageState kind="empty" title="暂无指南" description="指南发布后会在这里展示。" />
      ) : null}

      {!loading && !error && pages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {GUIDE_ENTRIES.map((entry) => {
            const page = pages.find((item) => item.slug === entry.slug);
            if (!page) return null;
            return (
              <li key={page.id}>
                <Link
                  to={entry.href}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent"
                >
                  <h2 className="section-heading">{entry.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {entry.description}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
