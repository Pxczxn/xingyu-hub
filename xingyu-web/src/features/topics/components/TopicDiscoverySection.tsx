import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { TopicSummary } from "@/api/topics/topics.types";
import { TopicVisual } from "@/components/visual/TopicVisual";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/cn";

/*
 * 话题发现区 —— 「热门话题」与「最近活跃」并列。
 *
 * 两个模块回答的是不同问题：
 *
 *   热门话题  哪些方向的内容最多？      依据 contentCount（公开内容数），降序。
 *   最近活跃  哪些方向最近有人发布？    依据 lastPublishedAt（published_revision.published_at）。
 *
 * 两个依据都是服务端真实字段，来自同一个 `GET /api/v1/topics` 响应，页面不为它们
 * 额外发请求，也不逐个话题去查内容（那是 N+1）。
 *
 * 为什么不是 `TopicCard`：下方「全部话题」才是卡片网格，是这页的主体（P0）。
 * 发现区如果复用整张卡片，会和主体同质化，两块长得一样的东西读者分不清哪个是目录。
 * 这里用紧凑纵向列表：一条一行，名称 + 一条依据，密度高于卡片、视觉重量低于卡片。
 *
 * 数据不足时不做任何补齐：某个模块没有可展示的话题就整块不渲染，另一个模块自然占满
 * 它那一列（`md:grid-cols-2` 的两列高度互不牵连）。不摆占位、不编「持续升温」。
 */

type DiscoveryProps = {
  hot: TopicSummary[];
  recent: TopicSummary[];
};

/** 行数上限。两个模块都不补满：有多少真实数据就展示多少。 */
export const DISCOVERY_LIMIT = 4;

export function TopicDiscoverySection({ hot, recent }: DiscoveryProps) {
  if (hot.length === 0 && recent.length === 0) return null;

  /*
   * 只有一边有数据时铺满整行，而不是固定留一个空列。
   * 这件事在旧后端上会真实发生：`lastPublishedAt` 未上线前「最近活跃」整块不存在，
   * 若仍按两列排，右半边就是一块空白 —— 那正是这次重构要消掉的「无意义留白」。
   */
  const bothModules = hot.length > 0 && recent.length > 0;

  return (
    <div
      className={cn(
        // 默认 stretch：两栏等高由 grid 决定，卡片内部再靠 `h-full` 吃满。
        "grid gap-4",
        bothModules ? "md:grid-cols-2" : "md:grid-cols-1",
      )}
      data-testid="topic-discovery"
    >
      {hot.length > 0 ? (
        <DiscoveryModule
          id="hot-topics"
          title="热门话题"
          hint="按公开内容数排序"
          topics={hot}
          ranked
          meta={(topic) => `${topic.contentCount ?? 0} 篇内容`}
        />
      ) : null}
      {recent.length > 0 ? (
        <DiscoveryModule
          id="recent-topics"
          title="最近活跃"
          hint="按最近一次公开发布排序"
          topics={recent}
          meta={(topic) => formatRelativeTime(topic.lastPublishedAt) ?? ""}
        />
      ) : null}
    </div>
  );
}

function DiscoveryModule({
  id,
  title,
  hint,
  topics,
  ranked = false,
  meta,
}: {
  id: string;
  title: string;
  hint: string;
  topics: TopicSummary[];
  /** 只给「热门」用：名次是这一组的真实属性（内容数排序），不是装饰。 */
  ranked?: boolean;
  meta: (topic: TopicSummary) => string;
}) {
  return (
    <section
      aria-labelledby={id}
      /*
        `h-full` + `flex-col`：两栏是 1:1 的并列模块，等高由外层 grid 的 stretch 决定，
        所以卡片要吃掉整格高度。内容仍然从顶部开始，不居中、不拉伸行距 —— 等高说的是
        卡片边界，不是把四行撑开。
      */
      className="flex h-full min-w-0 flex-col rounded-xl border border-border/50 bg-card p-4"
    >
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="text-sm font-semibold text-primary">
          {title}
        </h2>
        {/* 排依据写出来，读者才知道顺序是什么意思；不写就成了「看起来像热度」的猜测。 */}
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      </div>

      <ul className="flex list-none flex-col p-0">
        {topics.map((topic, index) => {
          const metaText = meta(topic);
          return (
            <li key={topic.id} className="min-w-0 border-b border-border/40 last:border-b-0">
              {/*
                一行的信息结构：引导符号 → 名称 → 依据 → 出口。

                两个模块用同一种行高（`min-h-11`）和同一种引导符号尺寸（24px），
                所以四行的两栏高度天然一致，不需要给卡片写死高度。

                · 热门的引导符号是名次徽章：前三名用品牌色底，其余用中性底 ——
                  名次是这一组真实的排序属性，不是装饰，所以徽章只在「热门」出现。
                · 最近活跃的引导符号是话题视觉，因为这一组的关键是「哪个方向」，
                  不是「第几名」。
                · 末尾箭头只在悬浮时出现：它回答「这一行能不能点」，不占常态视觉。
              */}
              <Link
                to={`/topics/${encodeURIComponent(topic.slug)}`}
                className="group focus-ring -mx-2 flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                {ranked ? (
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold tabular-nums",
                      index < 3
                        ? "bg-accent-soft text-accent-strong"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                ) : (
                  <TopicVisual
                    name={topic.name}
                    stableKey={topic.slug || topic.id}
                    className="h-6 w-6 shrink-0 rounded-full"
                  />
                )}

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary transition-colors group-hover:text-accent-strong">
                  {topic.name}
                </span>

                {metaText ? (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {metaText}
                  </span>
                ) : null}

                {/* 悬浮才出现的出口箭头：常态不占视觉，读到行可点时它就在。 */}
                <ChevronRight
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
