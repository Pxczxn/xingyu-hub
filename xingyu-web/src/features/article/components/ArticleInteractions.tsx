import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Heart } from "lucide-react";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { useAuth } from "@/features/auth/auth.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * Article interaction bar.
 *
 * Like: verified working on the real backend (POST/DELETE 204, status {liked},
 * count {count}) — implemented with an optimistic update, a duplicate-click
 * guard, and a rollback on failure.
 *
 * Bookmark: RESTORED (2026-10-10 P0-C). The 2026-09-29 note that hid the
 * control claimed the backend never writes `search_document`, making every
 * bookmark 404 — that is no longer true: publishing now emits
 * PUBLICATION_SUCCEEDED, SearchIndexEventHandler indexes the article, and the
 * full lifecycle (add / remove / repeat / status re-read / guest behavior) is
 * pinned by BookmarkLifecycleIntegrationTest +
 * SearchIndexPipelineIntegrationTest. Same optimistic/guard/rollback
 * discipline as Like; status is viewer-scoped so guests get `bookmarked:
 * false` from the public status endpoint without firing a doomed request.
 */
export function ArticleInteractions({
  objectType = "ARTICLE",
  objectId,
}: {
  objectType?: string;
  objectId: string;
}) {
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guests cannot read like *status* or bookmark state (verified: 401
    // AUTH_REQUIRED), so those stay request-free. The *count* is different: it is
    // a public aggregate (the interceptor allows GET /likes/{type}/{id}/count
    // without a session) and discovery cards already show it to guests — hiding
    // it here made the article page say less about a piece than the card that led
    // to it did.
    if (!isAuthenticated) {
      setLiked(false);
      setBookmarked(false);
      let active = true;
      interactionsApi
        .getLikeCount(objectType, objectId)
        .then((r) => active && setCount(r.count))
        .catch(() => active && setCount(null));
      return () => {
        active = false;
      };
    }
    let active = true;
    interactionsApi
      .getLikeCount(objectType, objectId)
      .then((r) => active && setCount(r.count))
      .catch(() => active && setCount(null));
    interactionsApi
      .getLikeStatus(objectType, objectId)
      .then((r) => active && setLiked(r.liked))
      .catch(() => undefined);
    interactionsApi
      .getBookmarkStatus(objectType, objectId)
      .then((r) => active && setBookmarked(r.bookmarked))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [objectType, objectId, isAuthenticated]);

  async function toggleLike() {
    if (pending) return; // duplicate-click guard
    setError(null);
    const next = !liked;
    /*
      Snapshot + restore, NOT reverse arithmetic.

      The rollback used to subtract 1 (`c + (next ? -1 : 1)`). That is only
      valid when both writes share one basis, and here they do not: if the
      reader clicks before the count request resolves, `count` is still `null`,
      so the optimistic write changes nothing — but a failure landing after the
      GET has arrived would then subtract 1 from the server's number and print
      a count that never existed. Restoring the snapshot is correct on every
      interleaving, including that one.
    */
    const snapshot = count;
    setLiked(next);
    setCount(count === null ? null : Math.max(0, count + (next ? 1 : -1)));
    setPending(true);
    try {
      if (next) await interactionsApi.like(objectType, objectId);
      else await interactionsApi.unlike(objectType, objectId);
    } catch {
      setLiked(!next);
      setCount(snapshot);
      setError("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function toggleBookmark() {
    if (pending) return; // duplicate-click guard
    setError(null);
    const next = !bookmarked;
    // Optimistic update, rolled back if the request fails.
    setBookmarked(next);
    setPending(true);
    try {
      if (next) await interactionsApi.addBookmark(objectType, objectId);
      else await interactionsApi.removeBookmark(objectType, objectId);
    } catch {
      setBookmarked(!next);
      setError("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isAuthenticated ? (
        <>
          <Button
            type="button"
            variant={liked ? "default" : "outline"}
            size="sm"
            disabled={pending}
            aria-pressed={liked}
            onClick={() => void toggleLike()}
          >
            <Heart className={cn("mr-1.5 h-4 w-4", liked && "fill-current")} aria-hidden />
            {liked ? "已赞" : "点赞"}
            {count !== null ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
          </Button>
          <Button
            type="button"
            variant={bookmarked ? "default" : "outline"}
            size="sm"
            disabled={pending}
            aria-pressed={bookmarked}
            onClick={() => void toggleBookmark()}
          >
            <Bookmark className={cn("mr-1.5 h-4 w-4", bookmarked && "fill-current")} aria-hidden />
            {bookmarked ? "已收藏" : "收藏"}
          </Button>
        </>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Heart className="h-4 w-4" aria-hidden />
          {count !== null ? `${count} 赞` : "点赞"}
          <Link to="/login" className="ml-1 text-accent-strong hover:underline">
            登录后互动
          </Link>
        </span>
      )}

      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
