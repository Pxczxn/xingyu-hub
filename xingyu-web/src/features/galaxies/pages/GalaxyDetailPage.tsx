import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyContent, GalaxyMember } from "@/api/galaxies/galaxies.types";
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
      className="group focus-ring inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-accent"
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

function GalaxyContentRows({ items, slug }: { items: GalaxyContent[]; slug: string }) {
  return (
    <ul className="divide-y divide-border/60 border-t border-border/60">
      {items.map((item) => (
        <li
          key={item.id}
          className="group flex items-center gap-3 py-3 transition-colors hover:bg-muted/35"
        >
          <ContentVisual
            stableKey={`${slug}:${item.id}`}
            objectType={item.objectType}
            variant="compact"
            className="h-9 w-9 aspect-auto rounded-md"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{galaxyContentTypeLabel(item.objectType)}</span>
              {item.pinned ? (
                <span className="inline-flex items-center gap-1 text-accent/80">
                  <Pin className="h-3 w-3" aria-hidden />
                  置顶
                </span>
              ) : null}
            </div>
            <Link
              to={contentHref({ id: item.objectId, objectType: item.objectType })}
              className="focus-ring block truncate text-sm font-semibold text-primary transition-colors hover:text-accent"
            >
              {item.title}
            </Link>
          </div>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-1"
            aria-hidden
          />
        </li>
      ))}
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
  const previewMembers = members.kind === "ready" ? members.items.slice(0, 6) : [];

  return (
    <div className="space-y-7 pt-5">
      <section aria-labelledby="galaxy-content-area">
        <div className="sr-only" id="galaxy-content-area">
          星系内容
        </div>
        {content.kind === "loading" ? <SectionMessage>正在加载内容…</SectionMessage> : null}
        {content.kind === "error" ? (
          <SectionMessage error>最近内容暂时不可用。</SectionMessage>
        ) : null}
        {content.kind === "ready" ? (
          <>
            {pinnedContent.length > 0 ? (
              <section aria-labelledby="galaxy-pinned-content" className="mb-7">
                <h2
                  id="galaxy-pinned-content"
                  className="mb-3 text-lg font-semibold tracking-tight text-primary"
                >
                  置顶内容
                </h2>
                <GalaxyContentRows items={pinnedContent} slug={slug} />
              </section>
            ) : null}
            <section aria-labelledby="galaxy-recent-content">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2
                  id="galaxy-recent-content"
                  className="text-lg font-semibold tracking-tight text-primary"
                >
                  最近内容
                </h2>
                <SectionLink to={`/galaxies/${encodeURIComponent(slug)}/content`}>
                  查看全部
                </SectionLink>
              </div>
              {recentContent.length > 0 ? (
                <GalaxyContentRows items={recentContent} slug={slug} />
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
      </section>

      <section aria-labelledby="galaxy-members">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="galaxy-members" className="text-lg font-semibold tracking-tight text-primary">
            星系成员
          </h2>
          <SectionLink to={`/galaxies/${encodeURIComponent(slug)}/members`}>全部成员</SectionLink>
        </div>
        {members.kind === "loading" ? <SectionMessage>正在加载成员…</SectionMessage> : null}
        {members.kind === "error" ? <SectionMessage error>成员暂时不可用。</SectionMessage> : null}
        {members.kind === "ready" && previewMembers.length === 0 ? (
          <SectionMessage>暂无公开成员</SectionMessage>
        ) : null}
        {members.kind === "ready" && previewMembers.length > 0 ? (
          <ul className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/60 pt-3">
            {previewMembers.map((member) => {
              const name = member.displayName || member.username;
              return (
                <li key={member.userId}>
                  <Link
                    to={`/u/${encodeURIComponent(member.username)}`}
                    aria-label={name}
                    className="group focus-ring inline-flex items-center gap-2.5 rounded-md py-1.5"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-32 truncate text-sm font-medium text-primary transition-colors group-hover:text-accent">
                        {name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
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
    </div>
  );
}
