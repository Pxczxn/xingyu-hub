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
      <PageHero eyebrow="MOMENTS" title="动态" description="分享此刻的想法，也看看社区正在发生什么。" tone="violet" />

      {isAuthenticated ? (
        <form onSubmit={(event) => void onCreate(event)} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <label className="block text-sm font-medium">
            动态正文
            <textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          {bodyError ? (
            <p role="alert" className="text-sm text-destructive">
              {bodyError}
            </p>
          ) : null}
          {createError ? (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          ) : null}
          <Button type="submit">发布动态</Button>
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
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/moments/${item.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
              >
                <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
                <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">
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
