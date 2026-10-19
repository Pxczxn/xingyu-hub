import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { cn } from "@/lib/cn";
import type { RecommendedCreator } from "../use-recommended-creators";

/*
 * 推荐创作者 — sidebar module.
 *
 * Presentational only: the fan-out, the follow state and its failure handling
 * live in `useRecommendedCreators`, so this file has no data rules of its own.
 *
 * The header link goes to /creators and says 「全部」, not 「换一批」. There is no
 * endpoint that reshuffles the sample — the rail always fans out to the same
 * first topics — so "换一批" would promise something the click cannot deliver.
 *
 * A follow button appears only for a signed-in viewer: a guest cannot follow,
 * and a button that would 401 is worse than no button.
 */
export function RecommendedCreatorsPanel({
  status,
  creators,
  signedIn,
  followError,
  pendingUsername,
  onToggleFollow,
}: {
  status: SectionStatus;
  creators: RecommendedCreator[];
  signedIn: boolean;
  followError: string | null;
  pendingUsername: string | null;
  onToggleFollow: (creator: RecommendedCreator) => void;
}) {
  if (status === "empty") return null;

  return (
    <section
      aria-labelledby="home-recommended-creators"
      className="sidebar-card group rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="home-recommended-creators"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Users className="h-3.5 w-3.5" aria-hidden />
          </span>
          推荐创作者
        </h2>
        <Link
          to="/creators"
          className="group/link shrink-0 inline-flex items-center gap-1 text-xs text-accent-strong transition-all hover:gap-1.5 hover:text-accent-strong/80"
        >
          <span>查看全部</span>
          <svg
            className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <SectionState
        status={status}
        emptyText="暂无推荐创作者"
        className="border-0 bg-transparent p-0"
      >
        <>
          {followError ? (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {followError}
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {creators.map((creator) => (
              <li key={creator.username} className="flex items-start gap-3">
                {creator.avatar ? (
                  <img
                    src={creator.avatar}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-accent/10"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/20 to-accent/10 text-sm font-semibold text-accent-foreground"
                  >
                    {creator.displayName.slice(0, 1)}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${encodeURIComponent(creator.username)}`}
                    className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-accent-strong"
                  >
                    {creator.displayName}
                  </Link>
                  {creator.bio ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {creator.bio}
                    </p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {typeof creator.followerCount === "number" ? (
                      <span>{creator.followerCount} 关注者</span>
                    ) : null}
                    <span>·</span>
                    <span>{creator.contentCount} 篇内容</span>
                  </div>
                </div>

                {signedIn ? (
                  <button
                    type="button"
                    onClick={() => onToggleFollow(creator)}
                    disabled={pendingUsername === creator.username}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-50",
                      creator.following
                        ? "border-border bg-card text-foreground hover:bg-muted"
                        : "border-accent/30 bg-accent/10 text-accent-foreground hover:bg-accent/20 hover:shadow-sm",
                    )}
                  >
                    {creator.following ? "已关注" : "关注"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      </SectionState>
    </section>
  );
}
