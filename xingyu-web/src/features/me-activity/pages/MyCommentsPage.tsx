import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { ApiError } from "@/api/client";
import { myCommentsApi } from "@/api/me-activity/me-activity.api";
import { MY_ACTIVITY_LIMIT, type MyCommentView } from "@/api/me-activity/me-activity.types";
import { contentHref } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * My comments (Phase 2J-1) — what the session user has said.
 *
 * `/me/comments` returns a BARE array, so like MyLikesPage this is one bounded
 * read with no pagination control (no cursor exists to follow).
 *
 * TWO HONESTY CONSTRAINTS, both from the server:
 *
 *  1. The SQL filters `status = 'VISIBLE'`. A comment the user wrote that was
 *     later hidden or removed does NOT appear. So the header says 「我的评论」
 *     and the list says what it is — it must never claim to be 全部评论 / 完整
 *     记录, because a missing row is not evidence the user never wrote it.
 *
 *  2. `objectTitle` falls back to the raw objectId when the target has no
 *     `search_document` row. We render that as-is; substituting a nicer-looking
 *     placeholder would hide the fact that the target is gone.
 *
 * Each row links to the CONTENT the comment was left on — not to the comment
 * itself. `MyCommentView.id` is the comment's own id and Legacy had a
 * `/comments/:id` route, but V2 ships no such route, so linking there would
 * produce a dead link. `contentHref` resolves ARTICLE / SERIES / MOMENT and
 * degrades unmapped types to /discover.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; comments: MyCommentView[] };

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

export function MyCommentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    myCommentsApi
      .list(MY_ACTIVITY_LIMIT)
      .then((comments) => {
        if (active) setState({ kind: "ready", comments });
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
              : (state.detail ?? "无法读取你的评论记录，请稍后重试。")
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

  const { comments } = state;

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden />
          我的评论
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你在社区的评论记录。已隐藏或删除的评论不会显示在这里。
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">评论记录</h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-xs text-muted-foreground">最多 {MY_ACTIVITY_LIMIT} 条</span>
        </div>

        {comments.length === 0 ? (
          <div className="p-5">
            <PageState
              kind="empty"
              title="暂无评论"
              description="参与讨论后，你的评论会出现在这里。"
            />
          </div>
        ) : (
          <ul aria-label="我的评论列表" className="divide-y divide-border">
            {comments.map((comment) => (
              <li key={comment.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)]">
                <time
                  dateTime={comment.createdAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(comment.createdAt)}
                </time>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {comment.body?.trim() || "（无内容）"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    评论于{" "}
                    {/* Links to the commented content: V2 has no /comments/:id,
                        so linking to the comment id would be a dead link. */}
                    <Link
                      to={contentHref({ id: comment.objectId, objectType: comment.objectType })}
                      className="text-accent hover:underline"
                    >
                      {comment.objectTitle || comment.objectId}
                    </Link>
                    <span className="ml-1">（{comment.objectType}）</span>
                  </p>
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

