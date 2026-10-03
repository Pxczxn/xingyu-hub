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
      className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-none"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="home-recommended-creators" className="text-sm font-semibold text-primary">
          推荐创作者
        </h2>
        <Link to="/creators" className="shrink-0 text-xs text-accent hover:underline">
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
          <ul className="flex flex-col gap-2.5">
            {creators.map((creator) => (
              <li key={creator.username} className="flex items-center gap-3">
                {creator.avatar ? (
                  <img
                    src={creator.avatar}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                  >
                    {creator.displayName.slice(0, 1)}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${encodeURIComponent(creator.username)}`}
                    className="block truncate text-sm font-medium text-foreground hover:text-accent"
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
                      "shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                      creator.following
                        ? "border-border bg-card text-foreground hover:bg-muted"
                        : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
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
