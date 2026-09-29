import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyMember } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { formatJoinedAt, galaxyMemberRoleLabel } from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; members: GalaxyMember[] };

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND");
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
  }, [slug]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return <PageState kind="error" title="成员加载失败" description="请稍后重试。" />;
  }

  const { members } = state;

  return (
    <section>
      <h2 className="text-lg font-semibold text-primary">成员</h2>
      <p className="mt-1 text-sm text-muted-foreground">{`共 ${members.length} 位公开成员`}</p>
      {members.length === 0 ? (
        <PageState kind="empty" title="暂无公开成员" description="成员加入后会显示在这里。" />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <li key={member.userId}>
              <Link
                to={`/u/${encodeURIComponent(member.username)}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-accent"
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
                <time className="shrink-0 text-xs text-muted-foreground">{formatJoinedAt(member.joinedAt)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

