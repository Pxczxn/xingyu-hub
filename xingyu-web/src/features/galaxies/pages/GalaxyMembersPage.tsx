import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyMember } from "@/api/galaxies/galaxies.types";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { formatJoinedAt, galaxyMemberRoleLabel } from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; members: GalaxyMember[] };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Galaxy member roster (Phase 2H).
 *
 * Backend: `GET /api/v1/galaxies/{slug}/members?limit=N`, default 50. There is
 * no pagination cursor, so the list is capped rather than paged — a galaxy with
 * more members than the cap simply shows the first N.
 */
export function GalaxyMembersPage() {
  return (
    <GalaxyShell activeTab="members">
      {(galaxy) => <GalaxyMembers slug={galaxy.slug} />}
    </GalaxyShell>
  );
}

const MEMBER_LIMIT = 50;

function GalaxyMembers({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    galaxiesApi
      .listMembers(slug, MEMBER_LIMIT)
      .then((members) => {
        if (active) setState({ kind: "ready", members });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "ready" : "error", members: [] } as LoadState);
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="成员加载失败" description="请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const { members } = state;

  return (
    <PageSection id="galaxy-members" title="成员" description={`共 ${members.length} 位公开成员`}>
      {members.length === 0 ? (
        <PageState kind="empty" title="暂无公开成员" description="成员加入后会显示在这里。" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <li key={member.userId}>
              {/*
                Whole-card target, so it earns `.card-lift` — the lift tells the
                truth here. `hover:border-accent` is gone: `.card-lift` already
                carries the hover, and its documented move is to sharpen the edge
                (`/70` to full) rather than change its hue — the same call
                `AnnouncementsPage` recorded. `focus-ring` because the whole card
                is this grid's only keyboard stop and nothing global styles it.
              */}
              <Link
                to={`/u/${encodeURIComponent(member.username)}`}
                className="card-lift focus-ring flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {(member.displayName || member.username).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-foreground">
                    {member.displayName || member.username}
                  </strong>
                  <small className="mt-0.5 block truncate text-xs text-muted-foreground">{`@${member.username}`}</small>
                  <small className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {galaxyMemberRoleLabel(member.role)}
                  </small>
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatJoinedAt(member.joinedAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  );
}
