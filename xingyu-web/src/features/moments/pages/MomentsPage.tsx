import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
import { FEED_LIMIT, type MomentView } from "@/api/moments/moments.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { PageHero } from "@/components/shared/PageHero";

type LoadState = "loading" | "error" | "ready";

function formatMomentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MomentsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<MomentView[]>([]);
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    momentsApi
      .list(FEED_LIMIT)
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setBodyError("请填写动态正文");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBodyError(null);
    setCreateError(null);
    try {
      const created = await momentsApi.create({ body: trimmed });
      navigate(`/moments/${created.id}`);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.problem.detail : "发布失败，请稍后重试。");
      pendingRef.current = false;
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") return <PageState kind="error" />;

  return (
    <div className="section-gap">
      <PageHero
        eyebrow="MOMENTS"
        title="动态"
        description="分享此刻的想法，也看看社区正在发生什么。"
        tone="violet"
      />

      {isAuthenticated ? (
        /*
          Publish dock, not an open form.
          The old composer was a full-width panel whose only affordance was a
          button at the bottom-left, visually detached from the textarea above
          it. A dock puts the invitation and the action on the same baseline:
          the reader sees what this is and what happens next in one glance.
          The label stays (as `sr-only`) so the textarea keeps its accessible
          name — it just stops occupying a line of its own.
        */
        <form
          onSubmit={(event) => void onCreate(event)}
          className="overflow-hidden rounded-xl border border-border/70 bg-card"
        >
          <div className="flex items-center gap-2 border-b border-border/60 bg-surface-sunken/40 px-4 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            <p className="text-meta font-medium text-foreground-soft">发布 dock</p>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <label className="block">
              <span className="sr-only">动态正文</span>
              <textarea
                name="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="分享此刻的想法…"
                className="focus-ring min-h-24 w-full resize-y rounded-lg border border-input bg-surface-sunken/50 px-3 py-2.5 text-card text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-card"
              />
            </label>

            {bodyError ? (
              <p role="alert" className="text-meta text-destructive">
                {bodyError}
              </p>
            ) : null}
            {createError ? (
              <p role="alert" className="text-meta text-destructive">
                {createError}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-meta text-muted-foreground">
                {body.trim().length > 0 ? `${body.trim().length} 字` : "说点什么再发布"}
              </span>
              <Button type="submit" size="sm">
                发布动态
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link to="/login?returnTo=%2Fmoments" className="text-accent hover:underline">
            发布动态
          </Link>
          需要先登录。
        </p>
      )}

      {items.length === 0 ? (
        <PageState kind="empty" title="暂时还没有动态" />
      ) : (
        /*
          Feed, not a list of identical grey cards.
          The body is the content of a moment, so it is set at the card step and
          in the primary colour; the timestamp is the only muted line. There is
          deliberately NO author line: `MomentView` carries `{id, body,
          createdAt}` and nothing else, so an avatar here would be invented.
          That is a contract gap to fix on the backend, not something to paper
          over with a placeholder face.
        */
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/moments/${item.id}`}
                className="focus-ring block rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-accent-line"
              >
                <p className="whitespace-pre-wrap text-card leading-6 text-primary">{item.body}</p>
                <time
                  dateTime={item.createdAt}
                  className="mt-2.5 block text-meta text-muted-foreground"
                >
                  {formatMomentTime(item.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
