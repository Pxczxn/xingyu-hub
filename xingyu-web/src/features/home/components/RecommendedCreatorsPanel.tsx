import { Link } from "react-router-dom";
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
      className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="home-recommended-creators" className="text-sm font-semibold text-foreground">
          推荐创作者
        </h2>
        <Link
          to="/creators"
          className="shrink-0 text-xs text-accent-strong transition-colors hover:underline"
        >
          全部 ›
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
              <li key={creator.username} className="flex items-center gap-3">
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
                  <p className="truncate text-xs text-muted-foreground">
                    {creator.contentCount} 篇内容
                  </p>
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
