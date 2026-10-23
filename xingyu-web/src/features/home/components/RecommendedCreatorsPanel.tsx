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
      className="rounded-2xl border border-border/60 bg-card/60 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="home-recommended-creators"
          className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent-strong">
            <Users className="h-3.5 w-3.5" aria-hidden />
          </span>
          推荐创作者
        </h2>
        <Link
          to="/creators"
          className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-accent-strong"
        >
          查看全部 →
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
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-foreground-soft"
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
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {typeof creator.followerCount === "number" ? (
                      <span>{creator.followerCount} 关注者</span>
                    ) : null}
                    {typeof creator.followerCount === "number" ? <span>·</span> : null}
                    <span>{creator.contentCount} 篇</span>
                  </div>
                </div>

                {signedIn ? (
                  <button
                    type="button"
                    onClick={() => onToggleFollow(creator)}
                    disabled={pendingUsername === creator.username}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                      creator.following
                        ? "border border-border text-muted-foreground hover:bg-surface-sunken"
                        : "bg-accent-soft text-accent-strong hover:bg-accent/20",
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
