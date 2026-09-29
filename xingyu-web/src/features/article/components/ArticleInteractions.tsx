import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
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
 * Bookmark: deliberately NOT rendered. The backend bookmark endpoint is
 * non-functional (POST is a no-op, DELETE returns 500) — see
 * api/interactions/interactions.api.ts. Phase 1B must not surface a control
 * that is known not to work.
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Both like endpoints require auth (verified: 401 AUTH_REQUIRED for guests),
    // so guests fire no request at all — otherwise we would issue a call that
    // can never succeed.
    if (!isAuthenticated) {
      setCount(null);
      setLiked(false);
      return;
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
    return () => {
      active = false;
    };
  }, [objectType, objectId, isAuthenticated]);

  async function toggleLike() {
    if (pending) return; // duplicate-click guard
    setError(null);
    const next = !liked;
    // Optimistic update, rolled back if the request fails.
    setLiked(next);
    setCount((c) => (c === null ? c : Math.max(0, c + (next ? 1 : -1))));
    setPending(true);
    try {
      if (next) await interactionsApi.like(objectType, objectId);
      else await interactionsApi.unlike(objectType, objectId);
    } catch {
      setLiked(!next);
      setCount((c) => (c === null ? c : Math.max(0, c + (next ? -1 : 1))));
      setError("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isAuthenticated ? (
        <Button
          type="button"
          variant={liked ? "primary" : "outline"}
          size="sm"
          disabled={pending}
          aria-pressed={liked}
          onClick={() => void toggleLike()}
        >
          <Heart className={cn("mr-1.5 h-4 w-4", liked && "fill-current")} aria-hidden />
          {liked ? "已赞" : "点赞"}
          {count !== null ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
        </Button>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Heart className="h-4 w-4" aria-hidden />
          {count !== null ? `${count} 赞` : "点赞"}
          <Link to="/login" className="ml-1 text-accent hover:underline">
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
