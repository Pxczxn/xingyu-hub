import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyContent, GalaxyMember } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { contentHref } from "@/components/shared/ContentCard";
import {
  formatJoinedAt,
  galaxyContentTypeLabel,
  galaxyMemberRoleLabel,
} from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState = "loading" | "error" | "ready";

/*
 * Galaxy overview (Phase 2H).
 *
 * Members and content are the two secondary lists the backend exposes; this page
 * shows a preview of each and links out to the dedicated tabs. Both calls run in
 * parallel and both are best-effort: a failure on one must not blank the page,
 * because the galaxy header already rendered successfully.
 */
export function GalaxyDetailPage() {
  return (
    <GalaxyShell activeTab="overview">
      {(galaxy) => <GalaxyOverview slug={galaxy.slug} />}
    </GalaxyShell>
  );
}

function GalaxyOverview({ slug }: { slug: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [members, setMembers] = useState<GalaxyMember[]>([]);
  const [content, setContent] = useState<GalaxyContent[]>([]);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    Promise.allSettled([galaxiesApi.listMembers(slug, 8), galaxiesApi.listContent(slug, 12)]).then(
      ([memberResult, contentResult]) => {
        if (!active) return;
        setMembers(memberResult.status === "fulfilled" ? memberResult.value : []);
        setContent(contentResult.status === "fulfilled" ? contentResult.value : []);
        setLoadState(
          memberResult.status === "rejected" && contentResult.status === "rejected" ? "error" : "ready",
        );
      },
    );
    return () => {
      active = false;
    };
  }, [slug]);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return <PageState kind="error" title="星系内容加载失败" description="星系信息已加载，但成员与内容暂时不可用。" />;
  }

  // Pinned items lead, mirroring the Legacy detail page's ordering.
  const sortedContent = [...content].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <>
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">最新内容</h2>
          <Link to={`/galaxies/${encodeURIComponent(slug)}/content`} className="text-sm text-accent hover:underline">
            查看全部
          </Link>
        </div>
        {sortedContent.length === 0 ? (
          <PageState kind="empty" title="暂无内容" description="运营关联的内容会展示在这里。" />
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {sortedContent.slice(0, 4).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link to={contentHref({ id: item.objectId, objectType: item.objectType })} className="text-sm font-medium hover:text-accent">
                  {item.title}
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {galaxyContentTypeLabel(item.objectType)}
                </span>
                {item.pinned ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">置顶</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">星系成员</h2>
          <Link to={`/galaxies/${encodeURIComponent(slug)}/members`} className="text-sm text-accent hover:underline">
            全部成员
          </Link>
        </div>
        {members.length === 0 ? (
          <PageState kind="empty" title="暂无可展示的成员" />
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {members.slice(0, 4).map((member) => (
              <li key={member.userId} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {(member.displayName || member.username).slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <Link to={`/u/${encodeURIComponent(member.username)}`} className="block truncate text-sm font-medium hover:text-accent">
                    {member.displayName || member.username}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {`${galaxyMemberRoleLabel(member.role)} · ${formatJoinedAt(member.joinedAt)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

