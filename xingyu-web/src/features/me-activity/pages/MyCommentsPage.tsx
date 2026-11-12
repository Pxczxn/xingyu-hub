import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { myCommentsApi } from "@/api/me-activity/me-activity.api";
import { MY_ACTIVITY_LIMIT, type MyCommentView } from "@/api/me-activity/me-activity.types";
import { ArchetypeFrame } from "@/components/layout";
import { contentHref } from "@/components/shared/ContentCard";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
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
 *
 * 骨架（A §3 `/me/*` 表 · MyComments = SK6 · 线/松/齐）
 * -------------------------------------------------
 * 与 MyLikesPage 同为 SK6、同一组数据形状，但要能一眼分开，所以取的是**另一组轴值**：
 *   H=线：`PageMasthead`，与 MyLikes 一致（线是这一域列表页的基线页头）。
 *   D=松：每条评论**是独立卡面**（`rounded-card` + 1px 发丝边 + 卡内 padding），
 *         不是 MyLikes 那种发丝线行。首屏因此至多三块，与「扫式时间流」是两种读法：
 *         评论正文要逐条读，行式会把三行正文压成一条细缝。
 *   R=齐：**没有 rail**，主列与页头同宽同边。这是本批里同 SK 页面「有无右栏」这一档
 *         差异的对照组：MyLikes / MyFollowing 有右栏（错），本页没有（齐）。
 *
 * 条目内部结构（三种 SK6 里的第三种）：正文（可多行、保留换行）→ 来源行，
 * 与 MyLikes 的「类型压在标题上方」、Follow 的「@username · 关注于」都不同。
 *
 * 行为未变：`myCommentsApi.list(MY_ACTIVITY_LIMIT)`、`reloadKey` 重试、
 * 三态文案、`<ul aria-label="我的评论列表">` 全部原样保留。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

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
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { comments } = state;

  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="loose"
      headerSlot={
        <PageMasthead
          title="我的评论"
          description="你在社区的评论记录。已隐藏或删除的评论不会显示在这里。"
        />
      }
    >
      <section aria-labelledby="comments-record-heading" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
          <h2 id="comments-record-heading" className="section-heading">
            评论记录
          </h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-caption text-muted-foreground">最多 {MY_ACTIVITY_LIMIT} 条</span>
        </div>

        {comments.length === 0 ? (
          <div className="pt-6">
            <PageState
              kind="empty"
              title="暂无评论"
              description="参与讨论后，你的评论会出现在这里。"
            />
          </div>
        ) : (
          /* D=松：每条独立卡面，间距与卡内 padding 都走 `.density-loose` 提供的
             变量，所以「松」只有一处定义（ArchetypeFrame 的 density 参数）。 */
          <ul aria-label="我的评论列表" className="flex flex-col gap-[var(--density-list-gap)] pt-4">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
              >
                <p className="whitespace-pre-wrap text-body leading-7 text-foreground">
                  {comment.body?.trim() || "（无内容）"}
                </p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-caption text-muted-foreground">
                  <span>评论于</span>
                  {/* Links to the commented content: V2 has no /comments/:id,
                      so linking to the comment id would be a dead link. */}
                  <Link
                    to={contentHref({ id: comment.objectId, objectType: comment.objectType })}
                    className="focus-ring text-accent-strong hover:underline"
                  >
                    {comment.objectTitle || comment.objectId}
                  </Link>
                  <span>（{comment.objectType}）</span>
                  <time
                    dateTime={comment.createdAt}
                    className="ml-auto shrink-0 tabular-nums text-muted-foreground"
                  >
                    {formatTime(comment.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center">
        <Link to="/discover" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          去探索更多内容
        </Link>
      </p>
    </ArchetypeFrame>
  );
}
