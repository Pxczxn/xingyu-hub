import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { myLikesApi } from "@/api/me-activity/me-activity.api";
import { MY_ACTIVITY_LIMIT, type MyLikeView } from "@/api/me-activity/me-activity.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { contentHref } from "@/components/shared/ContentCard";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
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
 *
 * 骨架（A §3 `/me/*` 表 · MyLikes = SK6 · 线/紧/错）
 * ---------------------------------------------
 * 这一页是 /me 域 11 个列表页里第一个「带右栏」的 SK6，与样板 书架
 * （BookshelfPage = 线/紧/齐）刻意不同：
 *   H=线：`PageMasthead` —— 无面、无边框，标题贴内容列左缘，首屏由第一条行开始。
 *   D=紧：`FeedRow` 行式、发丝线分隔、无逐项卡面。
 *   R=错：`rail` 存在，`ArchetypeFrame` 走 `lg:[1fr|300px]`，主列右侧有 300px 轨。
 * 于是同一批「我的列表」里，书架是单列齐、这一页是主列+侧轨错 —— 构图不同，
 * 而不是同一套栅格换 padding。
 *
 * 条目内部结构（与 FollowListPage 同为 紧/错，靠这里区分）：
 *   - 本页条目**没有头像/缩略图**（点赞记录没有可用的图片字段），左缘直接是标题；
 *   - 元信息是**两行**：类型独占一行压在标题上方，时间在行尾（`FeedRow` 的 meta 槽）。
 *   - FollowListPage 的条目有 44px 头像、元信息压成一行（@username · 关注于…）。
 *
 * 右栏两块（`点赞概览` / `最近点赞`）**只从本页已取回的 `MyLikeView[]` 派生**：
 * 不新增 api、不加请求、不编造「本月点赞趋势」这类后端没有返回的数字。
 *
 * 行为未变：数据获取（`myLikesApi.list(MY_ACTIVITY_LIMIT)`）、`reloadKey` 重试、
 * 加载/错误/空态文案、`<ul aria-label="我的点赞列表">` 这个测试钉住的 landmark
 * 逐条保留。错误分支仍在 `ArchetypeFrame` 之外早退，所以那条路径完全没有布局改动。
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

/** 排序用的时间戳；缺失或不可解析一律当 0，让它们排到最后。 */
function createdAtMs(value?: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function MyLikesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
              : (state.detail ?? "无法读取你的点赞记录，请稍后重试。")
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

  const { likes } = state;

  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead
          title="我的喜欢"
          description="你当前点赞过的内容。取消点赞后，条目会从这里移除。"
        />
      }
      /*
       * 右栏只在真有内容时出现：两块都是对 `likes` 的派生统计，空态下它只能
       * 复述「0 条」，与空态文案重复。无 rail 时 frame 自动退回单列（SOLO.SK6）。
       */
      rail={likes.length > 0 ? <LikesRail likes={likes} /> : null}
      /* landmark 名与两块面板标题不同名，否则同一句话在无障碍树里出现两次。 */
      railLabel="点赞侧栏"
    >
      <section aria-labelledby="likes-record-heading" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
          <h2 id="likes-record-heading" className="section-heading">
            点赞记录
          </h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-caption text-muted-foreground">最多 {MY_ACTIVITY_LIMIT} 条</span>
        </div>

        {likes.length === 0 ? (
          <div className="pt-6">
            <PageState
              kind="empty"
              title="暂无点赞"
              description="为喜欢的内容点个赞，它会出现在这里。"
            />
          </div>
        ) : (
          <ul aria-label="我的点赞列表" className="flex flex-col">
            {likes.map((like) => (
              // No `id` on MyLikeView — objectType+objectId is the composite key.
              <FeedRow
                key={`${like.objectType}:${like.objectId}`}
                meta={
                  <time dateTime={like.createdAt} className="tabular-nums">
                    {formatTime(like.createdAt)}
                  </time>
                }
              >
                {/* 元信息第一行：原始 objectType。未映射的类型因此可见，而不是
                    悄悄变成一个指向别处的链接。 */}
                <p className="text-caption text-muted-foreground">{like.objectType}</p>
                <Link
                  to={contentHref({ id: like.objectId, objectType: like.objectType })}
                  className="focus-ring mt-1 block truncate text-h3 text-primary hover:text-accent-strong"
                >
                  {like.title || like.objectId}
                </Link>
              </FeedRow>
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

/**
 * 右栏：两块真实信息，全部由本页已取回的 `MyLikeView[]` 派生。
 *
 * 刻意不放「本月点赞数 / 点赞环比」这类后端没有返回的指标 —— 编一组数字就是
 * 假数据。这里的两个数字和三条标题都能从 `likes` 复核。
 */
function LikesRail({ likes }: { likes: MyLikeView[] }) {
  const latest = [...likes]
    .sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))
    .slice(0, 3);
  const typeCount = new Set(likes.map((like) => like.objectType)).size;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="likes-rail-overview"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="likes-rail-overview" className="text-h3 text-primary">
          点赞概览
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-caption text-muted-foreground">点赞条数</dt>
            <dd className="mt-1 text-metric leading-none tabular-nums text-primary">
              {likes.length}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">涉及类型</dt>
            <dd className="mt-1 text-metric leading-none tabular-nums text-primary">{typeCount}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="likes-rail-latest"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="likes-rail-latest" className="text-h3 text-primary">
          最近点赞
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {latest.map((like) => (
            <li
              key={`${like.objectType}:${like.objectId}`}
              className="flex items-baseline justify-between gap-3"
            >
              {/* 不用标题元素：行流里那条标题才是条目标题，右栏这里是同一内容的
                  索引副本，重复成标题会让它在无障碍树里出现两次。 */}
              <span className="min-w-0 truncate text-meta text-foreground-soft">
                {like.title || like.objectId}
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">{like.objectType}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
