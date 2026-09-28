import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { galaxyKindLabel } from "../galaxy-labels";

type LoadState = "loading" | "error" | "ready";

/**
 * Galaxy square (Phase 2H).
 *
 * Backend: `GET /api/v1/galaxies` -> GalaxySummary[], guest-readable. The
 * endpoint ignores `limit` and has no cursor, so the whole list arrives at once;
 * search below is a client-side filter rather than a round trip.
 */
export function GalaxyListPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<GalaxySummary[]>([]);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let active = true;
    galaxiesApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") return <PageState kind="error" />;

  const trimmed = keyword.trim();
  const visible = trimmed
    ? items.filter(
        (item) => item.name.includes(trimmed) || item.slug.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : items;

  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">星系</h1>
        <p className="mt-1 text-sm text-muted-foreground">围绕共同兴趣聚合内容与成员的社区单元。</p>
      </header>

      {items.length === 0 ? (
        <PageState kind="empty" title="还没有星系" description="星系创建后会显示在这里。" />
      ) : (
        <>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索星系名称"
            aria-label="搜索星系"
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {visible.length === 0 ? (
            <PageState kind="empty" title="没有匹配的星系" description="换个关键词试试。" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/galaxies/${encodeURIComponent(item.slug)}`}
                    className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
                  >
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{galaxyKindLabel(item.official)}</span>
                      <span>{`${item.memberCount} 位成员`}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
