import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * FeedRow — one row in a time-ordered stream.
 *
 * BELONGS TO: SK6 信息流 (home, my-* lists, topic stream, profile). Rows carry
 * no card surface: the separator is a hairline, or a zebra tint, and the whole
 * row is the target.
 * AXIS: D = 紧 (row rhythm, no per-item card) — the visible difference from
 * SK2, where the same items are equal-weight cells with card faces.
 *
 * `as` picks the element: `li` for streams that sit in a `<ul>`, `article` for a
 * standalone entry that is not part of a list, and `div` for the two cases the
 * first two cannot serve — the caller already owns the `<article>`/`<li>` (a
 * link wrapper, a keyed list item) or the row sits in a container that is not a
 * list at all. Nested `<article>` was the concrete failure: `HomeFeedItem` and
 * the topic stream already render `<article>` inside the row, and an
 * `as="article"` row put a second `<article>` around it.
 *
 * `style` exists for ONE thing — the staggered entrance. See the prop note.
 *
 * Nothing here fetches, formats or decides — the slots are the whole API.
 */
export type FeedRowProps = {
  /** Main body: title, excerpt, whatever the row is about. */
  children: ReactNode;
  /** Leading visual slot (cover, avatar). Omit for a text-only row. */
  lead?: ReactNode;
  /** Trailing meta (time, counts), aligned to the end of the row. */
  meta?: ReactNode;
  /**
   * `li` when the row lives in a `<ul>`/`<ol>`, `article` when it is a
   * standalone entry, `div` when the caller already owns the semantics or has
   * no list to nest into.
   */
  as?: "li" | "article" | "div";
  /**
   * 错峰入场用这个槽传 `style={{ animationDelay: staggerDelay(index) }}`，
   * **不要给行容器传 `transform`**，两个原因都是实测的：
   *
   *   1. 入场动画 `animate-rise-in` 的 keyframes 自己就声明 `transform`。动画
   *      运行期间 keyframe 覆盖内联值，动画结束后内联值再生效 —— 元素会在动画
   *      收尾时「跳」到自己写的位置，而不是停在动画的终点。
   *   2. 行容器上任何 `transform` 都会让它变成新的 containing block +
   *      stacking context。行内已有的 `position: sticky`/`fixed` 子元素（粘底
   *      操作条、浮层锚点）会改以这一行为参照系，并且每行各开一个合成层 ——
   *      开销随行数线性增长，而错峰本身一个字节都不需要它。
   */
  style?: CSSProperties;
  className?: string;
};

export function FeedRow({ children, lead, meta, as = "li", style, className }: FeedRowProps) {
  const rowClassName = cn(
    "group relative flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border/60 px-1 py-4 last:border-b-0",
    className,
  );

  const body = (
    <>
      {lead ? <div className="shrink-0">{lead}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {meta ? (
        <div className="ml-auto flex shrink-0 items-center gap-3 text-meta text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </>
  );

  if (as === "article") {
    return (
      <article className={rowClassName} style={style}>
        {body}
      </article>
    );
  }

  if (as === "div") {
    return (
      <div className={rowClassName} style={style}>
        {body}
      </div>
    );
  }

  return (
    <li className={rowClassName} style={style}>
      {body}
    </li>
  );
}
