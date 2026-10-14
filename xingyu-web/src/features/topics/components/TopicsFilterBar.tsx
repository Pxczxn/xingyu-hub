import { Search, X } from "lucide-react";

/*
 * Topics plaza filter bar (设计方案 §3.3 第 2 行, P1) — sticky under the shell header.
 *
 * 2026-10-13 (批次 04) — 它原来是 `TopicsHero` 里的一块，和标题、描述共用同一张
 * 横幅卡。问题不在外观而在层级：搜索于是读起来像标题的附属说明，而不是「过滤
 * 整个列表」这个动作本身。搬出来之后它有了自己的整行宽度，滚动时也一直可用
 * （方案点名 sticky）。
 *
 * 三个实现细节，每个都对应一个会踩的坑：
 *
 *   1. 输入框是 `type="text"`，不是 `type="search"`。后者在 ARIA 里映射到
 *      `searchbox`，会让既有的 `getByRole("textbox", { name: "搜索话题" })` 失配；
 *      换来的只是各浏览器不一致的原生装饰，不值得为它改测试契约。
 *   2. 这里没有 `role="status"` 的结果计数。空结果块用的是 `role="status"`，同一
 *      页面上再来一个会让 `getByRole("status")` 变成二义。可见数量已经由下方
 *      `PageSection` 的 `count` 表达，不需要第二条通道。
 *   3. `bg-card` 是必需的而非装饰：sticky 表面若半透明，滚动时下方卡片会从它
 *      底下透出来。`lg:top-24` 与 TopicHeader / ArticleDetailPage / RulesPage 同值
 *      —— shell header 是 `sticky top-0 z-30`，24（96px）是给它留的固定偏移。
 *
 * 清除按钮放在这里而不是 section 的 action 里：搜索框和它的清除动作是同一件事，
 * 分开到两个位置会让人先滚回列表标题才能取消过滤。
 */
export function TopicsFilterBar({
  keyword,
  onKeywordChange,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
}) {
  const searching = keyword.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/70 bg-card px-3.5 py-2.5 lg:sticky lg:top-24 lg:z-20">
      {/*
       * `w-full` on a phone, a bounded field above it. The old header pinned this
       * to `w-80 shrink-0` (a fixed 320px that could not shrink) next to a ~470px
       * title block, so at 390px the whole page scrolled sideways by 52px. A search
       * field is also the one thing on this page worth a full line.
       */}
      <label className="relative block w-full min-w-0 sm:max-w-md">
        <span className="sr-only">搜索话题</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
          aria-hidden
        />
        <input
          type="text"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索话题名称或简介"
          aria-label="搜索话题"
          className="focus-ring h-9 w-full rounded-lg border border-input bg-surface-sunken/60 pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent-line focus-visible:bg-card"
        />
      </label>

      {searching ? (
        <button
          type="button"
          onClick={() => onKeywordChange("")}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          清除搜索
        </button>
      ) : null}
    </div>
  );
}
