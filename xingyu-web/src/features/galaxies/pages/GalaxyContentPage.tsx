import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyContent } from "@/api/galaxies/galaxies.types";
import { contentHref } from "@/components/shared/ContentCard";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import {
  GALAXY_CONTENT_FILTERS,
  type GalaxyContentFilter,
  galaxyContentTypeLabel,
} from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: GalaxyContent[] };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Galaxy content feed (Phase 2H).
 *
 * Backend: `GET /api/v1/galaxies/{slug}/content?limit=N`, default 20. Each row
 * carries an `objectType` + `objectId` pair, never a resolved path — the link is
 * derived through the shared `contentHref`, so an unmapped type degrades to
 * /discover instead of emitting a dead URL.
 *
 * Sorting is client-side: pinned first, then the order the backend returned.
 */
export function GalaxyContentPage() {
  return (
    <GalaxyShell activeTab="content">
      {(galaxy) => <GalaxyContentFeed slug={galaxy.slug} />}
    </GalaxyShell>
  );
}

const CONTENT_LIMIT = 30;

function GalaxyContentFeed({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [filter, setFilter] = useState<GalaxyContentFilter>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    galaxiesApi
      .listContent(slug, CONTENT_LIMIT)
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "ready" : "error", items: [] } as LoadState);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const rawItems = state.kind === "ready" ? state.items : [];

  const visible = useMemo(() => {
    const rows = rawItems.filter((item) => {
      if (pinnedOnly && !item.pinned) return false;
      if (filter && item.objectType.toUpperCase() !== filter) return false;
      return true;
    });
    return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [rawItems, pinnedOnly, filter]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return <PageState kind="error" title="内容加载失败" description="请稍后重试。" />;
  }

  return (
    <PageSection id="galaxy-content" title="关联内容" description={`共 ${rawItems.length} 条`}>
      {rawItems.length === 0 ? (
        <PageState kind="empty" title="暂无内容" description="运营关联的内容会展示在这里。" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {GALAXY_CONTENT_FILTERS.map((option) => (
              <Button
                key={option.label}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              variant={pinnedOnly ? "default" : "outline"}
              size="sm"
              aria-pressed={pinnedOnly}
              onClick={() => setPinnedOnly((value) => !value)}
            >
              仅看置顶
            </Button>
          </div>

          {visible.length === 0 ? (
            <PageState
              kind="empty"
              title="暂无匹配内容"
              description="当前筛选条件下没有可展示的内容。"
            />
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {visible.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link
                    to={contentHref({ id: item.objectId, objectType: item.objectType })}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {item.title}
                  </Link>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {galaxyContentTypeLabel(item.objectType)}
                  </span>
                  {item.pinned ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      置顶
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageSection>
  );
}
