import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { ApiError } from "@/api/client";
import { myLikesApi } from "@/api/me-activity/me-activity.api";
import { MY_ACTIVITY_LIMIT, type MyLikeView } from "@/api/me-activity/me-activity.types";
import { contentHref } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * My likes (Phase 2J-1) — the content the session user currently likes.
 *
 * `/me/likes` returns a BARE array (no cursor, no total), so this page is a
 * single bounded read and deliberately has NO pagination control: there is no
 * `nextCursor` to follow, and inventing a "load more" that re-fetches the same
 * head of the list would be a lie about the contract.
 *
 * WHAT THIS LIST IS NOT: it is not "content you have ever liked". There is no
 * status column on `content_like` — unliking DELETES the row. So a row present
 * here means "liked right now", and an item you unliked afterwards is simply
 * gone. The copy must not imply history.
 *
 * Titles come from `search_document`, with a server-side fallback to the raw
 * objectId when no document exists (an already-deleted target, most commonly).
 * A title that looks like `a UUID` is therefore real data, not a bug, and is
 * rendered as-is rather than replaced with a friendlier-looking guess.
 *
 * Links are built through the shared `contentHref`, which only resolves
 * ARTICLE / SERIES / MOMENT to real routes and degrades everything else to
 * /discover — never a guessed /u/:id. The raw `objectType` is still shown next
 * to the timestamp so an unmapped type is visible to the reader instead of
 * silently becoming a link to the wrong place.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; likes: MyLikeView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MyLikesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    myLikesApi
      .list(MY_ACTIVITY_LIMIT)
      .then((likes) => {
        if (active) setState({ kind: "ready", likes });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired
              ? "登录状态已过期，请重新登录。"
              : (state.detail ?? "无法读取你的点赞记录，请稍后重试。")
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { likes } = state;

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <Heart className="h-5 w-5" aria-hidden />
          我的喜欢
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你当前点赞过的内容。取消点赞后，条目会从这里移除。
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="section-heading">点赞记录</h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-xs text-muted-foreground">最多 {MY_ACTIVITY_LIMIT} 条</span>
        </div>

        {likes.length === 0 ? (
          <div className="p-5">
            <PageState
              kind="empty"
              title="暂无点赞"
              description="为喜欢的内容点个赞，它会出现在这里。"
            />
          </div>
        ) : (
          <ul aria-label="我的点赞列表" className="divide-y divide-border">
            {likes.map((like) => (
              // No `id` on MyLikeView — objectType+objectId is the composite key.
              <li
                key={`${like.objectType}:${like.objectId}`}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)]"
              >
                <time
                  dateTime={like.createdAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(like.createdAt)}
                </time>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{like.objectType}</p>
                  <Link
                    to={contentHref({ id: like.objectId, objectType: like.objectType })}
                    className="mt-1 block truncate text-sm font-medium text-foreground hover:text-accent"
                  >
                    {like.title || like.objectId}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center">
        <Link to="/discover" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          去发现更多内容
        </Link>
      </p>
    </div>
  );
}
