import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";
import { galaxyKindLabel } from "../galaxy-labels";

type LoadState = "loading" | "error" | "ready";

function memberLabel(memberCount: number): string {
  return memberCount > 0 ? `${memberCount} 位成员` : "暂无成员";
}

function GalaxyLink({ item, featured = false }: { item: GalaxySummary; featured?: boolean }) {
  return (
    <li>
      <Link
        to={`/galaxies/${encodeURIComponent(item.slug)}`}
        className={cn(
          "group focus-ring block transition-colors hover:border-accent/55 hover:bg-card",
          featured ? "surface-compact p-4" : "rounded-lg border border-border/60 bg-card/70 p-4",
        )}
      >
        <div className={cn("flex items-center gap-4", !featured && "gap-3")}>
          <GalaxyVisual
            stableKey={item.slug}
            official={item.official}
            variant={featured ? "spotlight" : "compact"}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-primary transition-colors group-hover:text-accent">
              {item.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {galaxyKindLabel(item.official)} · {memberLabel(item.memberCount)}
            </span>
            {featured ? (
              <span className="mt-2 block text-xs font-medium text-accent">进入星系</span>
            ) : null}
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground/60 opacity-70 transition-[transform,opacity,color] group-hover:translate-x-1 group-hover:text-accent group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}

/** Public galaxy directory. Search remains a client-side filter over the live list API. */
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

  const visible = useMemo(() => {
    const trimmed = keyword.trim();
    if (!trimmed) return items;
    return items.filter(
      (item) =>
        item.name.includes(trimmed) || item.slug.toLowerCase().includes(trimmed.toLowerCase()),
    );
  }, [items, keyword]);

  const searching = keyword.trim().length > 0;
  const officialGalaxies = visible.filter((item) => item.official);
  const communityGalaxies = visible.filter((item) => !item.official);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") return <PageState kind="error" />;

  return (
    <div className="section-gap">
      <PageHero
        compact
        eyebrow="GALAXIES"
        title="星系"
        description="围绕共同兴趣聚合内容与成员，找到属于你的社区轨道。"
        tone="blue"
      />

      <label className="block max-w-sm">
        <span className="sr-only">搜索星系</span>
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索星系名称"
          aria-label="搜索星系"
          className="focus-ring h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        />
      </label>

      {items.length === 0 ? (
        <PageState kind="empty" title="还没有星系" description="星系创建后会显示在这里。" />
      ) : searching ? (
        <section aria-labelledby="galaxy-search-results">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2
              id="galaxy-search-results"
              className="text-lg font-semibold tracking-tight text-primary"
            >
              搜索结果
            </h2>
            <span className="text-sm text-muted-foreground">共 {visible.length} 个</span>
          </div>
          {visible.length > 0 ? (
            <ul className="grid gap-3 lg:grid-cols-3">
              {visible.map((item) => (
                <GalaxyLink key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <PageState kind="empty" title="没有匹配的星系" description="换个关键词试试。" />
          )}
        </section>
      ) : (
        <>
          {officialGalaxies.length > 0 ? (
            <section aria-labelledby="official-galaxies">
              <h2
                id="official-galaxies"
                className="mb-3 text-lg font-semibold tracking-tight text-primary"
              >
                官方星系
              </h2>
              <ul
                className={cn(
                  "grid gap-3",
                  officialGalaxies.length > 1 ? "lg:grid-cols-2" : "max-w-3xl",
                )}
              >
                {officialGalaxies.map((item) => (
                  <GalaxyLink key={item.id} item={item} featured />
                ))}
              </ul>
            </section>
          ) : null}

          {communityGalaxies.length > 0 ? (
            <section aria-labelledby="community-galaxies">
              <h2
                id="community-galaxies"
                className="mb-3 text-lg font-semibold tracking-tight text-primary"
              >
                社区星系
              </h2>
              <ul className="grid gap-3 lg:grid-cols-3">
                {communityGalaxies.map((item) => (
                  <GalaxyLink key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
