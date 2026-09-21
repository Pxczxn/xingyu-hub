import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { interactionsApi } from "@/api/interactions/interactions.api";
import type { CommentItem } from "@/api/interactions/interactions.types";
import { useAuth } from "@/features/auth/auth.store";
import { Button } from "@/components/ui/button";

/*
 * Comments (Phase 1B).
 *
 * Verified on the real backend: GET /api/v1/comments/{type}/{id} requires auth
 * (401 for guests); POST /api/v1/comments works when authenticated.
 * So guests see a sign-in prompt instead of an error, and no request is fired.
 */
export function CommentSection({
  objectType = "ARTICLE",
  objectId,
}: {
  objectType?: string;
  objectId: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setLoading(true);
    setError(false);
    interactionsApi
      .getComments(objectType, objectId)
      .then((items) => {
        if (!active) return;
        setComments(items);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [objectType, objectId, isAuthenticated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await interactionsApi.createComment({ objectType, objectId, body: text });
      setComments((current) => [...current, created]);
      setBody("");
    } catch {
      setSubmitError("评论发布失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="section-gap">
      <h2 id="comments-heading" className="text-base font-semibold text-primary">
        评论 {isAuthenticated && !loading ? `(${comments.length})` : ""}
      </h2>

      {!isAuthenticated ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          评论需要登录后查看。
          <Link to="/login" className="ml-1 text-accent hover:underline">
            去登录
          </Link>
        </p>
      ) : (
        <>
          <form onSubmit={submit} className="flex flex-col gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`以 ${user?.username ?? "当前账号"} 的身份发表评论`}
              aria-label="评论内容"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {submitError ? (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            ) : null}
            <div>
              <Button type="submit" disabled={submitting || !body.trim()}>
                {submitting ? "发布中…" : "发表评论"}
              </Button>
            </div>
          </form>

          {loading ? (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              加载评论中…
            </p>
          ) : null}

          {!loading && error ? (
            <p role="alert" data-testid="comments-error" className="text-sm text-destructive">
              评论加载失败
            </p>
          ) : null}

          {!loading && !error && comments.length === 0 ? (
            <p data-testid="comments-empty" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              还没有评论，来抢沙发。
            </p>
          ) : null}

          {!loading && !error && comments.length > 0 ? (
            <ul data-testid="comment-list" className="flex flex-col gap-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {comment.authorUsername ? (
                      <Link to={`/u/${comment.authorUsername}`} className="font-medium text-foreground hover:text-accent">
                        {comment.authorUsername}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">匿名</span>
                    )}
                    <span>{new Date(comment.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
