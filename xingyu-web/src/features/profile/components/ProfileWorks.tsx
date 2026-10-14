import { Link } from "react-router-dom";
import type { SpaceWorks } from "@/api/users/users.types";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/card";
import { ContentVisual } from "@/components/visual/ContentVisual";
import { staggerDelay } from "@/lib/stagger";

/*
 * Public works list for a profile.
 * Real endpoint: GET /api/v1/users/{username}/works -> { works: [{id,title,...}] }.
 *
 * 批次 06 四处改动：
 *
 *   1. 封面接上了。`SpaceWorkItem.coverUrl` 一直存在但从未被渲染，卡片只有文字。
 *      现在有封面就出图。**无封面时不出 `ContentVisual` 的装饰板** —— 装饰板是
 *      opt-in 的（见 ContentCard 的 `showFallbackVisual`），作品流里封面与无封面
 *      混杂，给每张空卡都铺一块装饰板会让整片网格读成「一片占位符」。宁可留白。
 *
 *   2. 分类显示名而不是原始 slug。旧实现直接打印 `categorySlug`，用户看到的是
 *      `tech-notes` 这种路由键。改成从 `works.categories` 反查 `name`；查不到时
 *      回落到 slug —— 那是契约异常，显示 slug 比显示空白诚实。
 *
 *   3. 卡片样式对齐 `ContentCard`（边框在 hover 时升温 + 轻阴影），标题字号走
 *      `text-card` 这一档。同时列表项用 `animate-rise-in` + `staggerDelay` 错峰入场。
 *
 *   4. `filterSlug` / `pending` —— 筛选切换的「切换动效」：请求在途时旧列表留在原地
 *      降到 60% 不透明度（而不是塌成加载卡再长回来），新列表到达后整片重放错峰入场。
 *
 * `filterSlug` 是 slug 而不是显示名，尽管文案要的是名字：名字从 `works.categories`
 * 反查即可（同一份数据、同一个 Map），让调用方再传一个可能过期的字符串没有意义。
 *
 * 空态文案必须点名分类：筛选后的「还没有」是假的（用户可能有很多文章，只是这个
 * 分类下没有），说清是哪个分类空了并指出怎么退出。
 */
export function ProfileWorks({
  works,
  filterSlug = null,
  pending = false,
}: {
  works: SpaceWorks;
  /** 当前筛选的分类 slug；`null` 表示未筛选。 */
  filterSlug?: string | null;
  /** 正在按新分类重新请求。列表保持原高度并降低不透明度，而不是塌成加载块。 */
  pending?: boolean;
}) {
  const categoryNames = new Map(works.categories.map((category) => [category.slug, category.name]));
  const filterName = filterSlug ? (categoryNames.get(filterSlug) ?? null) : null;

  /* Shared by both branches: while a filter request is in flight the previous content
     stays in place and dims instead of collapsing to a loading card and back. `aria-busy`
     sits on the element that is actually being replaced, so there is no wrapper node. */
  const pendingClass = cn("transition-opacity duration-150", pending && "opacity-60");

  return works.works.length === 0 ? (
    <p
      data-testid="works-empty"
      aria-busy={pending || undefined}
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground",
        pendingClass,
      )}
    >
      {!filterSlug
        ? "还没有公开文章。"
        : filterName
          ? `「${filterName}」下还没有公开文章，可切回「全部」查看。`
          : "这个分类下还没有公开文章，可切回「全部」查看。"}
    </p>
  ) : (
    <ul
      /* `key` 挂在列表上，不只是重渲染：React 会复用两批数据里 key 相同的 <li>，
         所以「筛选前后都在」的文章会保留已经跑完的 `animate-rise-in`，邻居飞入时
         它纹丝不动。按筛选重挂 <ul> 才能让整片网格重放错峰入场 —— 这就是这一页
         的「切换动效」。 */
      key={filterSlug ?? "all"}
      aria-busy={pending || undefined}
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", pendingClass)}
      data-testid="works-list"
    >
      {works.works.map((work, index) => {
        const categoryLabel = work.categorySlug
          ? (categoryNames.get(work.categorySlug) ?? work.categorySlug)
          : null;

        return (
          <li
            key={work.id}
            className="animate-rise-in min-w-0"
            /* Inline, not a class: `animate-rise-in` is the `animation` shorthand
               and resets `animation-delay` (see lib/stagger.ts). */
            style={{ animationDelay: staggerDelay(index) }}
          >
            <Card className="h-full transition-[border-color,box-shadow] hover:border-accent-line hover:shadow-sm">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                {work.coverUrl ? (
                  <ContentVisual
                    stableKey={work.id}
                    objectType="ARTICLE"
                    cover={work.coverUrl}
                    variant="card"
                  />
                ) : null}

                <div className="flex flex-1 flex-col gap-1.5">
                  <Link
                    to={`/articles/${work.id}`}
                    className="focus-ring line-clamp-2 text-card font-semibold text-primary transition-colors hover:text-accent-strong"
                  >
                    {work.title}
                  </Link>
                  {work.summary ? (
                    <p className="line-clamp-2 text-meta leading-5 text-muted-foreground">
                      {work.summary}
                    </p>
                  ) : null}
                  {categoryLabel ? (
                    /* `mt-auto` pins the chip to the bottom so the category row
                       lines up across cards of unequal text length. */
                    <span className="mt-auto w-fit rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium leading-4 text-accent-strong">
                      {categoryLabel}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
