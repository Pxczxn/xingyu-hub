import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { PageState } from "@/components/shared/PageState";
import { PageHero } from "@/components/shared/PageHero";

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
      <PageHero eyebrow="GUIDE" title="使用指南" description="从第一次进入星语，到找到自己的创作与交流方式。" action={<Link to="/rules" className="text-sm text-accent hover:underline">社区规则</Link>} />

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && pages.length === 0 ? (
        <PageState kind="empty" title="暂无指南" description="指南发布后会在这里展示。" />
      ) : null}

      {!loading && !error && pages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                to={`/guide/${encodeURIComponent(page.slug)}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
              >
                <h2 className="text-sm font-medium text-foreground">{page.title}</h2>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
