import { Link } from "react-router-dom";
import type { TopicSummary } from "@/api/topics/topics.types";
import { TopicVisual } from "@/components/visual/TopicVisual";

/*
 * Hot topics, as a compact chip row (批次 04).
 *
 * 它原来是六张 `min-h-[104px]` 的卡片，和下方的全部话题网格用同一个组件、同一套
 * 尺寸——于是页面顶部出现两片长得一样的网格，读者分不清哪一片是 P0。现在它退回
 * 到自己真正的角色：一排「按内容数排出来的快捷入口」，视觉重量远低于目录本身，
 * 把 P0 让给全部话题网格。
 *
 * 名称与内容数仍然是卡片（`TopicCard`）的重点，这里不是卡片：热度已经由顺序
 * 表达，chip 上再挂一个裸数字，读者无法判断它是内容数还是关注数。
 */
export function FeaturedTopics({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="featured-topics" className="min-w-0">
      <h2 id="featured-topics" className="mb-2.5 text-meta font-medium text-muted-foreground">
        热门话题
      </h2>
      {/*
       * Two columns on a phone is not needed here — chips wrap, so the row stays
       * one line per item and never squeezes a name into a 9px column.
       */}
      <ul className="flex list-none flex-wrap gap-2 p-0" data-testid="featured-topics">
        {topics.map((topic) => (
          <li key={topic.id} className="min-w-0">
            <Link
              to={`/topics/${encodeURIComponent(topic.slug)}`}
              className="group focus-ring inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/70 py-1 pl-1 pr-3.5 transition-colors hover:border-accent-line hover:bg-card"
            >
              <TopicVisual
                name={topic.name}
                stableKey={topic.slug || topic.id}
                className="h-7 w-7 rounded-full"
              />
              <span className="truncate text-meta font-medium text-primary transition-colors group-hover:text-accent-strong">
                {topic.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
