import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Network, Search, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageHero } from "@/components/shared/PageHero";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";
import { GalaxyTile } from "../components/GalaxyTile";

type PublicLoadState = "loading" | "error" | "ready";
type MineLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: GalaxySummary[] };

/*
 * Product education, compressed to one line (批次 03).
 *
 * The `index` field is gone with it: the numbers 01/02/03 existed to hold three
 * cards in a row level, and there are no cards any more. The `<ol>` and the
 * arrows between the steps carry the ordering on their own.
 */
const GALAXY_STEPS = [
  { title: "找到星系", icon: Search },
  { title: "加入星系", icon: UserPlus },
  { title: "参与其中", icon: Network },
] as const;

/** How many joined galaxies the shortcut strip shows before 「查看全部」. */
const MINE_PREVIEW_LIMIT = 5;

function GalaxyGrid({
  items,
  variant,
  className,
  featured = false,
  animate = false,
}: {
  items: GalaxySummary[];
  variant: "mine" | "official" | "community";
  className?: string;
  featured?: boolean;
  animate?: boolean;
}) {
  return (
    <ul className={cn("grid list-none gap-3 p-0", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn("min-w-0", animate && "animate-rise-in")}
          /* Inline, not a utility class: `animate-rise-in` is the `animation`
             shorthand and would reset `animation-delay` to 0 (see tailwind.config.ts). */
          style={animate ? { animationDelay: staggerDelay(index) } : undefined}
        >
          <GalaxyTile galaxy={item} variant={variant} featured={featured} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Joined galaxies as a horizontal strip of compact chips (设计方案 §3.4 第 1 行：
 * 「横向 3~5 个快捷进入」).
 *
 * It used to be a second `GalaxyGrid` — the same card as 探索星系, at the same
 * size, so the top of the page showed two grids that looked like one list cut in
 * half. The strip says the different thing it actually is: these are shortcuts
 * back into places you already belong to, not listings to browse. It also gives
 * 探索星系 back its role as the page's P0.
 */
function MineStrip({ items }: { items: GalaxySummary[] }) {
  return (
    <ul className="flex list-none flex-wrap gap-2 p-0">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="animate-rise-in min-w-0"
          style={{ animationDelay: staggerDelay(index) }}
        >
          <Link
            to={`/galaxies/${encodeURIComponent(item.slug)}`}
            className="group focus-ring inline-flex max-w-full items-center gap-2 rounded-full border border-accent-line/60 bg-accent-soft/40 py-1 pl-1 pr-3.5 transition-colors hover:border-accent-line hover:bg-accent-soft"
          >
            <GalaxyVisual
              stableKey={item.slug}
              official={item.official}
              variant="compact"
              className="h-7 w-7 rounded-full"
            />
            <span className="truncate text-meta font-medium text-primary transition-colors group-hover:text-accent-strong">
              {item.name}
            </span>
            {item.memberCount > 0 ? (
              <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                {item.memberCount}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/*
 * Galaxy plaza.
 *
 * The plaza keeps the shared PageHero primitive, but the galaxy mark stays a
 * quiet masthead rather than becoming a full-width scene. The directory is the
 * first substantial thing below it; product education stays at the page foot.
 *
 * 2026-10-13 (批次 03) — 三处结构改动：
 *
 *   1. 搜索移出 `PageHero.actions`，成为独立的一行 P1。它原本挂在横幅内部，
 *      和标题、描述共用一张卡，于是「过滤整个列表」这个动作读起来像横幅的
 *      附属说明。移出后它有了自己的宽度，也恢复了横幅的完整内边距。
 *      位置在「我的星系」之上是有意的：搜索时「我的星系」整块隐藏，搜索框
 *      若在其下方就会随之上移一格；放在上方则原地不动。
 *   2. 「我的星系」由网格卡片改成横向 chips（见 MineStrip）。
 *   3. 教学区由「标题 + lede + 三张卡 + 尾注」压成两行文本。它现在是页脚
 *      的一段说明，不再是和星系网格争夺视线的第四个区块。
 */
export function GalaxyListPage() {
  const { isAuthenticated } = useAuth();
  const [publicState, setPublicState] = useState<PublicLoadState>("loading");
  const [items, setItems] = useState<GalaxySummary[]>([]);
  const [mineState, setMineState] = useState<MineLoadState>({ kind: "idle" });
  const [keyword, setKeyword] = useState("");
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branch below. The effects keep their per-run `active` guards. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    galaxiesApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setPublicState("ready");
      })
      .catch(() => {
        if (active) setPublicState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMineState({ kind: "idle" });
      return;
    }

    let active = true;
    setMineState({ kind: "loading" });
    galaxiesApi
      .listMine()
      .then((mine) => {
        if (active) setMineState({ kind: "ready", items: mine });
      })
      .catch(() => {
        if (active) setMineState({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, reloadKey]);

  const visible = useMemo(() => {
    const trimmed = keyword.trim();
    if (!trimmed) return items;
    const normalized = trimmed.toLowerCase();
    return items.filter(
      (item) => item.name.includes(trimmed) || item.slug.toLowerCase().includes(normalized),
    );
  }, [items, keyword]);

  const searching = keyword.trim().length > 0;
  const officialGalaxies = items.filter((item) => item.official);
  const communityGalaxies = items.filter((item) => !item.official);
  const minePreview =
    mineState.kind === "ready" ? mineState.items.slice(0, MINE_PREVIEW_LIMIT) : [];

  if (publicState === "loading") return <PageState kind="loading" />;
  if (publicState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <PageHero
        eyebrow="GALAXIES"
        title="星系"
        description="围绕共同兴趣聚合内容与成员，找到属于你的社区轨道。"
        illustration={
          <GalaxyVisual
            stableKey="galaxy-plaza-masthead"
            variant="masthead"
            className="h-20 w-28"
          />
        }
      />

      {/* P1 搜索：全页过滤器，作用于下面每一个列表。 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="relative block w-full min-w-0 sm:max-w-md">
          <span className="sr-only">搜索星系</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden
          />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索星系名称"
            aria-label="搜索星系"
            className="focus-ring h-10 w-full rounded-lg border border-input bg-surface-sunken/60 pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent-line focus-visible:bg-card"
          />
        </label>
        {searching ? (
          <p role="status" className="text-meta tabular-nums text-muted-foreground">
            找到 {visible.length} 个星系
          </p>
        ) : null}
      </div>

      {searching ? (
        <PageSection
          id="galaxy-search-results"
          title="搜索结果"
          count={visible.length}
          action={
            <button
              type="button"
              onClick={() => setKeyword("")}
              className="focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
            >
              清除搜索
            </button>
          }
        >
          {visible.length > 0 ? (
            <GalaxyGrid
              items={visible}
              variant="community"
              className="sm:grid-cols-2 xl:grid-cols-3"
              animate
            />
          ) : (
            <p
              role="status"
              className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-meta text-muted-foreground"
            >
              没有匹配的星系
            </p>
          )}
        </PageSection>
      ) : (
        <>
          {isAuthenticated ? (
            <PageSection
              id="my-galaxies"
              title="我的星系"
              count={mineState.kind === "ready" ? mineState.items.length : undefined}
              action={
                /*
                 * Shown whenever there is anything joined — not only when the
                 * strip is truncated. `/me/galaxies` is the full page for this
                 * set (identity, join state, exploration), and it is the only
                 * route to it from here; gating it on `> MINE_PREVIEW_LIMIT`
                 * would strand a user with four galaxies with no way to reach it.
                 */
                mineState.kind === "ready" && mineState.items.length > 0 ? (
                  <Link
                    to="/me/galaxies"
                    className="focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
                  >
                    查看全部 →
                  </Link>
                ) : undefined
              }
            >
              {mineState.kind === "loading" ? (
                <p role="status" className="py-1 text-meta text-muted-foreground">
                  正在加载你加入的星系…
                </p>
              ) : null}
              {mineState.kind === "error" ? (
                <p role="alert" className="py-1 text-meta text-muted-foreground">
                  暂时无法读取你加入的星系，仍可继续浏览其他星系。
                </p>
              ) : null}
              {mineState.kind === "ready" && minePreview.length === 0 ? (
                <p role="status" className="py-1 text-meta text-muted-foreground">
                  你还没有加入星系，去下面看看有哪些社区吧。
                </p>
              ) : null}
              {mineState.kind === "ready" && minePreview.length > 0 ? (
                <MineStrip items={minePreview} />
              ) : null}
            </PageSection>
          ) : null}

          {items.length === 0 ? (
            <p
              role="status"
              className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-meta text-muted-foreground"
            >
              还没有星系，星系创建后会显示在这里。
            </p>
          ) : null}

          {officialGalaxies.length > 0 ? (
            <PageSection id="official-galaxies" title="官方星系">
              <GalaxyGrid
                items={officialGalaxies}
                variant="official"
                featured={officialGalaxies.length > 1}
                className={officialGalaxies.length > 1 ? "sm:grid-cols-2" : "max-w-xl"}
                animate
              />
            </PageSection>
          ) : null}

          {communityGalaxies.length > 0 ? (
            <PageSection id="explore-galaxies" title="探索星系" count={communityGalaxies.length}>
              <GalaxyGrid
                items={communityGalaxies}
                variant="community"
                className="sm:grid-cols-2 xl:grid-cols-3"
                animate
              />
            </PageSection>
          ) : null}

          {/*
            教学区（P3）。原来是一个完整的区块：标题 + lede + 三张卡 + 尾注，
            约占 250px 高，和 P0 的星系网格一样重。现在压成两行文本——读者是来
            找星系的，这段是给找不到方向的人兜底的一句话。
          */}
          <section aria-labelledby="about-galaxies" className="border-t border-border/70 pt-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <h2 id="about-galaxies" className="text-card font-semibold text-primary">
                如何开始？
              </h2>
              <ol className="flex list-none flex-wrap items-center gap-x-2 gap-y-1.5 p-0 text-meta text-muted-foreground">
                {GALAXY_STEPS.map(({ title, icon: Icon }, index) => (
                  <li key={title} className="flex items-center gap-2">
                    {index > 0 ? (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/40" aria-hidden />
                    ) : null}
                    <Icon
                      className="h-3.5 w-3.5 text-muted-foreground/70"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-2.5 text-meta text-muted-foreground">
              话题连接讨论方向，星系连接长期参与其中的人与内容。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
