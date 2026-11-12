import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { ArchetypeFrame, BleedBand } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
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
  const officialCount = items.filter((item) => item.official).length;

  /*
   * SK2 画廊 · H 线 / D 松 / R 出（A §3 的 `/me/*` 表 MyGalaxies 行）。
   *
   *   skeleton="SK2"    → 画廊原型：等权卡格、卡即链接。
   *   header="line"     → H=线：`PageMasthead`（无面 masthead，标题贴内容列左缘，
   *                       「浏览全部星系」进 actions 槽）。原来手写的
   *                       `<h1 className="text-2xl …">`（A §4 点名的 30 处之一）就此收敛，
   *                       页内仍只有这一个 h1。
   *   density="loose"   → D=松：每个星系一张独立卡面，卡距走 `--density-grid-gap`。
   *   R=出             → 首屏一条整幅出血带：`BleedBand` 用负 margin 把底色推到内容列
   *                       外缘，带里是**由 `items` 派生的量化带**（总数 / 官方 / 社区），
   *                       带下的卡格回到内容列。全页只此一条；空态时整条不渲染，
   *                       免得留下一条空带。
   *
   * 空态与错误分支原样保留（401 仍给「去登录」，其余给「重新加载」）。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="loose"
      headerSlot={
        <PageMasthead
          eyebrow="MY GALAXIES"
          title="我加入的星系"
          description={
            items.length > 0 ? `共 ${items.length} 个星系` : "你加入的星系会出现在这里。"
          }
          actions={
            <Link
              to="/galaxies"
              className="focus-ring rounded-sm text-sm text-accent-strong hover:underline"
            >
              浏览全部星系
            </Link>
          }
        />
      }
    >
      {items.length > 0 ? (
        <BleedBand tone="sunken" motif="orbit" contentClassName="px-4 py-8 md:px-6 md:py-10">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-muted-foreground">已加入</dt>
              <dd className="mt-1 text-metric font-bold tabular-nums text-primary">
                {items.length}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">官方星系</dt>
              <dd className="mt-1 text-metric font-bold tabular-nums text-primary">
                {officialCount}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">社区星系</dt>
              <dd className="mt-1 text-metric font-bold tabular-nums text-primary">
                {items.length - officialCount}
              </dd>
            </div>
          </dl>
        </BleedBand>
      ) : null}

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有加入任何星系"
          description="在星系广场找到感兴趣的星系并加入后，它会出现在这里。"
        />
      ) : (
        <ul
          className="grid gap-[var(--density-grid-gap)] sm:grid-cols-2"
          data-testid="my-galaxy-rows"
        >
          {items.map((item) => (
            <li key={item.id} className="flex">
              {/*
                Same shape as the member roster: a whole-card `<Link>` in a grid,
                so `.card-lift` is honest and the old `hover:border-accent` is
                dropped — the lift's own edge-sharpening is the hover language
                every other whole-card link in the app now speaks.
              */}
              <Link
                to={`/galaxies/${encodeURIComponent(item.slug)}`}
                className="card-lift focus-ring flex h-full w-full flex-col rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
              >
                <p className="text-card font-semibold text-primary">{item.name}</p>
                <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-meta text-muted-foreground">
                  <span>{galaxyKindLabel(item.official)}</span>
                  <span className="tabular-nums">{`${item.memberCount} 位成员`}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ArchetypeFrame>
  );
}
