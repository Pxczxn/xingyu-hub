import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { creatorDisplayName, creatorInitial, type CreatorCard } from "../creator-card";

/*
 * One creator card on /creators.
 *
 * Honesty rules baked into the rendering:
 *  - `profile.following` may be missing (the profile fetch is decorative). When
 *    it is absent we render NO follow button rather than guessing "关注" — a
 *    button that flips the wrong way is worse than no button.
 *  - `following` is only ever set from a successful response (see the page's
 *    toggle handler). The previous state is kept on failure.
 *  - A creator with no public work gets an explicit note, not an empty slot.
 */
export function CreatorCardItem({
  creator,
  onToggleFollow,
  followPending,
}: {
  creator: CreatorCard;
  onToggleFollow: (creator: CreatorCard) => void;
  followPending: boolean;
}) {
  const name = creatorDisplayName(creator);
  const avatar = creator.profile?.avatar ?? null;
  const following = creator.profile?.following;
  const work = creator.latestWork;

  return (
    <Card className="h-full" data-testid={`creator-card-${creator.username}`}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              creatorInitial(creator)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              <Link to={`/u/${encodeURIComponent(creator.username)}`} className="hover:text-accent">
                {name}
              </Link>
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {creator.topics.join(" · ") || "社区创作者"}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          已发布内容 <span className="font-medium text-foreground">{creator.contentCount}</span> 篇
        </p>

        {work ? (
          <Link
            to={`/articles/${encodeURIComponent(work.id)}`}
            className="block rounded-md border border-border p-3 hover:border-accent"
          >
            <span className="block text-xs text-muted-foreground">最新公开作品</span>
            <span className="line-clamp-2 text-sm font-medium text-foreground">
              {work.title || "未命名作品"}
            </span>
          </Link>
        ) : (
          <p
            className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
            data-testid={`creator-no-work-${creator.username}`}
          >
            暂未获得公开作品
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            to={`/u/${encodeURIComponent(creator.username)}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            查看主页
          </Link>
          {following === undefined ? null : (
            <Button
              type="button"
              size="sm"
              variant={following ? "outline" : "primary"}
              className="ml-auto"
              disabled={followPending}
              onClick={() => onToggleFollow(creator)}
            >
              {following ? "已关注" : "关注"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
