import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyContent, GalaxyMember } from "@/api/galaxies/galaxies.types";
import { ArchetypeFrame } from "@/components/layout";
import { ContentVisual } from "@/components/visual/ContentVisual";
import { contentHref } from "@/components/shared/ContentCard";
import { cn } from "@/lib/cn";
import { galaxyContentTypeLabel, galaxyMemberRoleLabel } from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type SectionState<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: T[] };

function SectionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group focus-ring inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-accent-strong"
    >
      {children}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}

function SectionMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn("py-4 text-sm", error ? "text-destructive" : "text-muted-foreground")}
    >
      {children}
    </p>
  );
}

function formatContentDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/**
 * 星系内容条目（Galaxy Content Contract，Phase 4.2）：title/summary 来自
 * search_document 活文档；cover 只有 ARTICLE 可能有，SERIES/MOMENT 用
 * ContentVisual 确定性视觉降级——三种内容类型的空封面都有设计感，且互不冒充。
 *
 * D=松（A §3 的 GalaxyDetail 行）：每条内容是**独立卡面**，卡与卡之间靠
 * `--density-grid-gap` 拉开，不再是「发丝线行」。这是本页与同域
 * GalaxyMembersPage（SK3·紧·齐，发丝线行、无轨）最直接的区分手段之一，
 * 另一个是右轨：本页有成员侧栏，成员页没有。
 */
function GalaxyContentCards({ items, slug }: { items: GalaxyContent[]; slug: string }) {
  return (
    <ul className="grid gap-[var(--density-grid-gap)]">
      {items.map((item) => {
        const dateLabel = formatContentDate(item.updatedAt);
        return (
          <li key={item.id}>
            <div className="group flex gap-4 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)] transition-colors hover:border-border">
              {item.cover ? (
                <img
                  src={item.cover}
                  alt=""
                  aria-hidden
                  className="h-16 w-24 shrink-0 rounded-md border border-border/50 object-cover"
                />
              ) : (
                <ContentVisual
                  stableKey={`${slug}:${item.id}`}
                  objectType={item.objectType}
                  variant="compact"
                  className="h-16 w-24 shrink-0 rounded-md border border-border/50 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                  <span>{galaxyContentTypeLabel(item.objectType)}</span>
                  {item.authorName ? <span>{item.authorName}</span> : null}
                  {dateLabel ? <span>{dateLabel}</span> : null}
                  {item.pinned ? (
                    <span className="inline-flex items-center gap-1 text-accent/80">
                      {/* Decorative: the word 置顶 beside it carries the state, so
                          the mark keeps the vivid brand gold rather than the
                          `--accent-strong` that text uses. */}
                      <Pin className="h-3 w-3" aria-hidden />
                      置顶
                    </span>
                  ) : null}
                </div>
                <Link
                  to={contentHref({ id: item.objectId, objectType: item.objectType })}
                  className="focus-ring block truncate text-card font-semibold text-primary transition-colors hover:text-accent-strong"
                >
                  {item.title}
                </Link>
                {item.summary ? (
                  <p className="mt-1 line-clamp-2 text-meta leading-5 text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}
              </div>
              <ArrowRight
                className="mt-6 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function GalaxyDetailPage() {
  return (
    <GalaxyShell activeTab="overview">
      {(galaxy) => <GalaxyOverview slug={galaxy.slug} />}
    </GalaxyShell>
  );
}

function GalaxyOverview({ slug }: { slug: string }) {
  const [members, setMembers] = useState<SectionState<GalaxyMember>>({ kind: "loading" });
  const [content, setContent] = useState<SectionState<GalaxyContent>>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setMembers({ kind: "loading" });
    galaxiesApi
      .listMembers(slug, 8)
      .then((items) => {
        if (active) setMembers({ kind: "ready", items });
      })
      .catch(() => {
        if (active) setMembers({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    setContent({ kind: "loading" });
    galaxiesApi
      .listContent(slug, 12)
      .then((items) => {
        if (active) setContent({ kind: "ready", items });
      })
      .catch(() => {
        if (active) setContent({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const orderedContent = useMemo(
    () =>
      content.kind === "ready"
        ? [...content.items].sort((a, b) => Number(b.pinned) - Number(a.pinned))
        : [],
    [content],
  );
  const pinnedContent = orderedContent.filter((item) => item.pinned).slice(0, 4);
  const recentContent = orderedContent
    .filter((item) => !item.pinned)
    .slice(0, Math.max(0, 4 - pinnedContent.length));

  /*
   * SK3 控制台 · H 壳 / D 松 / R 错（A §3 的 GalaxyDetail 行）。
   *
   *   skeleton="SK3"    → 控制台栅格；传 `rail` 即 `lg:[1fr | 280px]`，右轨由
   *                       `SectionRail` 粘住 —— 这就是 R=错（主列 + 侧轨）。
   *   header="shell"    → H=壳：标题由 `GalaxyShell` 出（`GalaxyShell.tsx:363` 的
   *                       `<h1>` = 星系名）。按 A §7.2 这是 **A 类壳**，页内
   *                       **不得再出 h1** —— 本文件一个 `<h1>` 都没有，标题层级
   *                       从 `h2`（`.section-heading`）起。
   *   density="loose"   → D=松：精选/最新每个内容条目独立成面，卡与卡由
   *                       `--density-grid-gap` 拉开（见 `GalaxyContentCards`）。
   *
   * 与同域 GalaxyMembersPage（SK3·壳/紧/齐）的一眼之别：本页**有右轨 + 独立卡面**，
   * 成员页**无轨 + 发丝线行**。两者四元组不同（松/错 vs 紧/齐），满足 A §2 第 1 条。
   *
   * 行为未变：两个 `SectionState` 状态机、精选在前/最多四条、成员预览最多六人、
   * 以及「内容失败不拖垮成员、成员失败不拖垮内容」的独立错误分支全部原样保留。
   */
  return (
    <ArchetypeFrame
      skeleton="SK3"
      header="shell"
      density="loose"
      rail={<GalaxyMembersPanel slug={slug} state={members} />}
      /* landmark 名与侧栏里那块卡的标题（「星系成员」）不同名，避免同名重复。 */
      railLabel="成员侧栏"
    >
      {content.kind === "loading" ? <SectionMessage>正在加载内容…</SectionMessage> : null}
      {content.kind === "error" ? (
        <SectionMessage error>最近内容暂时不可用。</SectionMessage>
      ) : null}
      {content.kind === "ready" ? (
        <>
          {pinnedContent.length > 0 ? (
            <section aria-labelledby="galaxy-pinned-content">
              <h2 id="galaxy-pinned-content" className="section-heading mb-4">
                精选内容
              </h2>
              <GalaxyContentCards items={pinnedContent} slug={slug} />
            </section>
          ) : null}

          <section aria-labelledby="galaxy-recent-content">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 id="galaxy-recent-content" className="section-heading">
                最新内容
              </h2>
              <SectionLink to={`/galaxies/${encodeURIComponent(slug)}/content`}>
                查看全部
              </SectionLink>
            </div>
            {recentContent.length > 0 ? (
              <GalaxyContentCards items={recentContent} slug={slug} />
            ) : (
              <SectionMessage>
                {pinnedContent.length > 0
                  ? "暂无最近内容。"
                  : "暂无内容，运营关联的内容会显示在这里。"}
              </SectionMessage>
            )}
          </section>
        </>
      ) : null}
    </ArchetypeFrame>
  );
}

/**
 * 右轨：成员预览（最多六人）。
 *
 * 它只是一个**内容组件** —— 粘住、滚动与 landmark 由 `ArchetypeFrame` 里的
 * `SectionRail` 负责（`SectionRail.tsx:41-56`），所以这里没有第二个 `<aside>`：
 * 两层 aside 会让页面出现两个同名区域。三态仍是本页自己的状态机，没有新增请求。
 */
function GalaxyMembersPanel({
  slug,
  state,
}: {
  slug: string;
  state: SectionState<GalaxyMember>;
}) {
  const previewMembers = state.kind === "ready" ? state.items.slice(0, 6) : [];

  return (
    <section
      aria-labelledby="galaxy-members"
      className="rounded-card border border-border/70 bg-card p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="galaxy-members" className="text-h3 font-semibold text-primary">
          星系成员
        </h2>
        <SectionLink to={`/galaxies/${encodeURIComponent(slug)}/members`}>全部成员</SectionLink>
      </div>
      {state.kind === "loading" ? <SectionMessage>正在加载成员…</SectionMessage> : null}
      {state.kind === "error" ? <SectionMessage error>成员暂时不可用。</SectionMessage> : null}
      {state.kind === "ready" && previewMembers.length === 0 ? (
        <SectionMessage>暂无公开成员</SectionMessage>
      ) : null}
      {state.kind === "ready" && previewMembers.length > 0 ? (
        <ul className="space-y-2.5">
          {previewMembers.map((member) => {
            const name = member.displayName || member.username;
            return (
              <li key={member.userId}>
                <Link
                  to={`/u/${encodeURIComponent(member.username)}`}
                  aria-label={name}
                  className="group focus-ring flex items-center gap-2.5 rounded-md py-1"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-36 truncate text-sm font-medium text-primary transition-colors group-hover:text-accent-strong">
                      {name}
                    </span>
                    <span className="block truncate text-meta text-muted-foreground">
                      {galaxyMemberRoleLabel(member.role)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
