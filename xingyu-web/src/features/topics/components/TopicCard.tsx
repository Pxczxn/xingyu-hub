import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import type { TopicSummary } from "@/api/topics/topics.types";
import { cn } from "@/lib/cn";
import { TopicVisual } from "@/components/visual/TopicVisual";

/*
 * One topic tile in the plaza grid (设计方案 §3.3 「话题卡片网格」).
 *
 * 2026-10-13 (批次 04) — 三处结构改动：
 *
 *   1. 卡片从「分隔线列表行」改成「网格卡」。原来非 featured 的卡片只有一条
 *      `border-b` 和透明底，整页读起来像一张长表格；方案要求 2~3 列的卡片网格，
 *      并列关系应当用卡片表达，而不是用上下相邻的行。
 *   2. 底部行拆成「事实 + 动作」两侧：左边是内容数与关注数——方案点名「名称与
 *      内容数」是卡片重点，因为这是判断一个话题活不活跃的唯一依据；右边是关注
 *      按钮（方案：位于右下，可点但不抢）。
 *   3. 名称由裸 `<h3>` 变成 `<h3>` 内的 `<Link>`。这是关注按钮进卡片的必要代价：
 *      整卡包 `<Link>` 时内部不能出现 `<button>`（交互元素不可嵌套），所以卡片
 *      容器降级为 `<article>`，唯一的出口收敛到名称上。
 *
 * 关注按钮只在「已登录且状态已知」时渲染（`following !== null`）。游客态不渲染，
 * 广场是浏览场景，六张卡各挂一个「登录后关注」只是同一个目的地的重复噪音。
 *
 * 关注状态由父级持有（`following` / `followPending` / `onToggleFollow`），卡片
 * 只负责渲染：广场页要跨卡管理乐观更新与失败回滚。
 *
 * `className` / `style` 透传到最外层 `<li>` 而不是里面的 `<article>`：卡片自己
 * 渲染 `<li>`（网格里它必须是一个列表项），调用方就没法再包一层来挂入场动画，
 * 所以这两个口子必须开在这里。`style` 是给 `animationDelay` 用的——Tailwind 的
 * `animate-*` 简写会重置 `animation-delay`，错峰只能走内联样式（见 lib/stagger.ts）。
 */
export function TopicCard({
  topic,
  following = null,
  followPending = false,
  onToggleFollow,
  className,
  style,
}: {
  topic: TopicSummary;
  /** null = 未登录或状态未知 —— 不渲染关注控件。 */
  following?: boolean | null;
  followPending?: boolean;
  onToggleFollow?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const contentLabel = (topic.contentCount ?? 0) > 0 ? `${topic.contentCount} 篇内容` : "暂无内容";
  const followerLabel =
    topic.followerCount && topic.followerCount > 0 ? `${topic.followerCount} 关注` : null;
  const showFollow = following !== null && Boolean(onToggleFollow);

  return (
    <li className={cn("min-w-0", className)} style={style}>
      {/*
        NOT `.card-lift`, and no `hover:` on the surface itself.

        The package here was inherited from `GalaxyTile`'s community variant —
        where it is correct, because there the whole tile IS a `<Link>`. Here
        the follow button forced the container down to `<article>` (point 3
        above), so raising the surface would promise a click the card cannot
        honour; globals.css is explicit about that failure — "the lift is a lie
        the click then corrects". The terminal value follows the three settled
        precedents for this shape (`FollowUserRow` / `EventCard` /
        `BookshelfPage`): `rounded-xl border border-border/70 bg-card p-4`.

        `group` moves down to the visual's own row, so the `TopicVisual`
        warm-up still fires on the one thing that IS a target — the name.
      */}
      <article className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
        <div className="group flex items-start gap-3">
          <TopicVisual name={topic.name} stableKey={topic.slug || topic.id} />
          <div className="min-w-0 flex-1">
            <h3 className="text-card font-semibold leading-6">
              <Link
                to={`/topics/${encodeURIComponent(topic.slug)}`}
                className="focus-ring text-primary transition-colors hover:text-accent-strong"
              >
                {/*
                  `aria-hidden` on the `#`: it is a typographic marker for「这是个话题」,
                  not part of the name. Without it every topic's accessible name starts
                  with a "#" and a screen reader announces it before the name itself.
                */}
                <span aria-hidden className="mr-1 text-accent-strong">
                  #
                </span>
                {topic.name}
              </Link>
            </h3>
            {topic.description ? (
              <p className="mt-1 line-clamp-2 text-meta leading-5 text-muted-foreground">
                {topic.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* `mt-auto` so tiles in the same row keep their fact row on one line even
            when only some of them carry a description. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-meta tabular-nums text-muted-foreground">
            {/*
              Each fact is its own text node and the separator is a sibling, so
              「3 篇内容」 and 「12 关注」 stay independently addressable — TopicHeader
              renders the same two facts and the detail tests match them exactly.
              Folding the separator into the label (" · 12 关注") would break that.
            */}
            <span>{contentLabel}</span>
            {followerLabel ? (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span>{followerLabel}</span>
              </>
            ) : null}
          </p>
          {showFollow ? (
            <button
              type="button"
              onClick={onToggleFollow}
              disabled={followPending}
              aria-pressed={following}
              className={cn(
                "focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-meta font-medium transition-colors disabled:opacity-60",
                following
                  ? "border-border bg-transparent text-muted-foreground hover:text-primary"
                  : "border-accent-line/70 bg-accent-soft/50 text-accent-strong hover:bg-accent-soft",
              )}
            >
              {following ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              )}
              {following ? "已关注" : "关注"}
            </button>
          ) : null}
        </div>
      </article>
    </li>
  );
}
