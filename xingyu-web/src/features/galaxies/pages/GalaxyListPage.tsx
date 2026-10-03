import { useEffect, useMemo, useState } from "react";
import { LogIn, Network, Search, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageHero } from "@/components/shared/PageHero";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { GalaxyTile } from "../components/GalaxyTile";

type PublicLoadState = "loading" | "error" | "ready";
type MineLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: GalaxySummary[] };

const GALAXY_STEPS = [
  {
    index: "01",
    title: "找到星系",
    description: "发现或搜索感兴趣的社区",
    icon: Search,
  },
  {
    index: "02",
    title: "加入星系",
    description: "加入星系；需要审核时提交申请",
    icon: UserPlus,
  },
  {
    index: "03",
    title: "参与其中",
    description: "查看星系内容和成员，持续参与社区",
    icon: Network,
  },
] as const;

function GalaxyGrid({
  items,
  variant,
  className,
  featured = false,
}: {
  items: GalaxySummary[];
  variant: "mine" | "official" | "community";
  className?: string;
  featured?: boolean;
}) {
  return (
    <ul className={cn("grid list-none gap-3 p-0", className)}>
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <GalaxyTile galaxy={item} variant={variant} featured={featured} />
        </li>
      ))}
    </ul>
  );
}

/*
 * Galaxy plaza.
 *
 * 2026-10-03 (layout pass) — this page used to carry its own SectionHeader and
 * its own banner, while the other six top-level surfaces used <PageHero/> and a
 * hand-rolled heading. Three consequences, all visible:
 *
 *   1. the banner's eyebrow/title/illustration breakpoints drifted from the rest
 *      of the site;
 *   2. the section headings were 18px — the same size as the banner h1 — so the
 *      page had no readable outline;
 *   3. a single official galaxy was capped at `max-w-[680px]`, leaving ~300px of
 *      dead space to its right on a 1200px shell.
 *
 * Both are now the shared primitives (PageHero / PageSection), and the official
 * grid collapses to one full-width column when there is only one card.
 */
export function GalaxyListPage() {
  const { isAuthenticated } = useAuth();
  const [publicState, setPublicState] = useState<PublicLoadState>("loading");
  const [items, setItems] = useState<GalaxySummary[]>([]);
  const [mineState, setMineState] = useState<MineLoadState>({ kind: "idle" });
  const [keyword, setKeyword] = useState("");

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
  }, []);

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
  }, [isAuthenticated]);

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
  const minePreview = mineState.kind === "ready" ? mineState.items.slice(0, 6) : [];

  if (publicState === "loading") return <PageState kind="loading" />;
  if (publicState === "error") return <PageState kind="error" />;

  return (
    <div className="section-gap">
      <PageHero
        eyebrow="GALAXIES"
        title="星系"
        description="围绕共同兴趣聚合内容与成员，找到属于你的社区轨道。"
        immersive
        illustration={
          <GalaxyVisual stableKey="galaxy-plaza-hero" variant="hero" className="h-32 w-full max-w-sm" />
        }
        actions={
          <label className="block w-full max-w-md">
            <span className="sr-only">搜索星系</span>
            <span className="relative block">
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
            </span>
          </label>
        }
        announcement={
          !isAuthenticated ? (
            <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
              <LogIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              登录后可以快速查看你已加入的星系。
            </p>
          ) : undefined
        }
      />

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
                <p role="status" className="py-3 text-meta text-muted-foreground">
                  正在加载你加入的星系…
                </p>
              ) : null}
              {mineState.kind === "error" ? (
                <p role="alert" className="py-3 text-meta text-muted-foreground">
                  暂时无法读取你加入的星系，仍可继续浏览其他星系。
                </p>
              ) : null}
              {mineState.kind === "ready" && minePreview.length === 0 ? (
                <p role="status" className="py-3 text-meta text-muted-foreground">
                  你还没有加入星系，去下面看看有哪些社区吧。
                </p>
              ) : null}
              {mineState.kind === "ready" && minePreview.length > 0 ? (
                <GalaxyGrid
                  items={minePreview}
                  variant="mine"
                  className="sm:grid-cols-2 xl:grid-cols-3"
                />
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
                featured
                className={officialGalaxies.length > 1 ? "sm:grid-cols-2" : undefined}
              />
            </PageSection>
          ) : null}

          {communityGalaxies.length > 0 ? (
            <PageSection
              id="explore-galaxies"
              title="探索星系"
              count={communityGalaxies.length}
            >
              <GalaxyGrid
                items={communityGalaxies}
                variant="community"
                className="sm:grid-cols-2 xl:grid-cols-3"
              />
            </PageSection>
          ) : null}

          {/*
            Product education. It used to be a 3-column `ol` separated by top
            borders only, which read as a table that had lost its rows, and the
            step icons sat in a `flex items-start gap-3` row so each description
            started at a different x offset (the icons differ in width). Now each
            step is a card and the number + icon share one fixed row, so the three
            columns line up.
          */}
          <section aria-labelledby="about-galaxies" className="border-t border-border/70 pt-8">
            <div className="max-w-2xl">
              <h2 id="about-galaxies" className="section-heading">
                如何开始？
              </h2>
              <p className="lede mt-1.5">从找到一个社区开始，逐步参与其中。</p>
            </div>

            <ol className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-3">
              {GALAXY_STEPS.map(({ index, title, description, icon: Icon }) => (
                <li
                  key={title}
                  className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-4"
                >
                  <span className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-[11px] font-semibold tabular-nums text-accent-strong">
                      {index}
                    </span>
                    <Icon
                      className="h-4 w-4 text-muted-foreground/70"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                  </span>
                  <span className="text-card font-semibold text-primary">{title}</span>
                  <span className="text-meta leading-6 text-muted-foreground">{description}</span>
                </li>
              ))}
            </ol>

            <p className="mt-5 text-meta text-muted-foreground">
              话题连接讨论方向，星系连接长期参与其中的人与内容。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
