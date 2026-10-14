import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { galaxyKindLabel } from "../galaxy-labels";

/*
 * 我加入的星系 (Phase 3I).
 *
 * Backend: `GET /api/v1/me/galaxies` -> GalaxySummary[], session-scoped. The
 * same call `GalaxyShell` already makes to decide its join-button state — this
 * page is the second consumer and the reason the endpoint stops being a
 * one-line side-channel.
 *
 * What this page adds over the public square (`/galaxies`):
 *   - It answers 「我加入了哪些」, which the square cannot: the square lists
 *     EVERY galaxy and carries no membership flag (GalaxySummary has no
 *     `joined` field — read the record). Deriving it client-side would mean
 *     calling `listMine` anyway, so the endpoint IS the feature.
 *   - The empty state is a real answer here ("你还没有加入任何星系"), whereas on
 *     the square an empty list only means the instance has no galaxies.
 *
 * 401 handling is left honest: an expired session shows the login prompt rather
 * than a generic failure, because a message-scoped read that fails on auth is
 * not a transient error.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; items: GalaxySummary[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function MyGalaxiesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    galaxiesApi
      .listMine()
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err) });
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
            state.expired ? "登录状态已过期，请重新登录。" : "无法读取你加入的星系，请稍后重试。"
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

  const { items } = state;

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">我加入的星系</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length > 0 ? `共 ${items.length} 个星系` : "你加入的星系会出现在这里。"}
          </p>
        </div>
        <Link to="/galaxies" className="text-sm text-accent-strong hover:underline">
          浏览全部星系
        </Link>
      </header>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有加入任何星系"
          description="在星系广场找到感兴趣的星系并加入后，它会出现在这里。"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="my-galaxy-rows">
          {items.map((item) => (
            <li key={item.id}>
              {/*
                Same shape as the member roster: a whole-card `<Link>` in a grid,
                so `.card-lift` is honest and the old `hover:border-accent` is
                dropped — the lift's own edge-sharpening is the hover language
                every other whole-card link in the app now speaks.
              */}
              <Link
                to={`/galaxies/${encodeURIComponent(item.slug)}`}
                className="card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4"
              >
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{galaxyKindLabel(item.official)}</span>
                  <span>{`${item.memberCount} 位成员`}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
