import { Link } from "react-router-dom";
import { Bookmark, Heart } from "lucide-react";
import type { SpaceWorkItem, SpaceWorks } from "@/api/users/users.types";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/card";
import { ContentVisual } from "@/components/visual/ContentVisual";
import { staggerDelay } from "@/lib/stagger";
import { formatFullDate } from "@/lib/relative-time";

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
 * 批次 07 两处改动：
 *
 *   1. 卡片补上真实元信息行：发布日期 + 点赞/收藏。这三个字段后端一直在返回、
 *      前端类型一直没声明（见 users.types.ts 的注释），所以作品流此前对读者是
 *      「一堆没有时间也没有反响的标题」—— 读者无法判断该先读哪一篇。
 *      每个字段都独立降级：没有 publishedAt 就不出日期，计数为 0 或缺失就不出
 *      对应图标（与 HomeFeedItem 同一套规则：0 赞不画一个「♡ 0」，那是噪音）。
 *
 *   2. **不渲染 `pinned`，也不写「置顶」/「最近更新」**。前者不可信
 *      （CreationSpaceService 在空间没有显式置顶时把最新一篇自动算作 pinned），
 *      后者会暗示一个排序承诺。日期标签只写「发布于」，那是 publishedAt 的字面
 *      含义，不含任何排序暗示。
 *
 * `filterSlug` 是 slug 而不是显示名，尽管文案要的是名字：名字从 `works.categories`
 * 反查即可（同一份数据、同一个 Map），让调用方再传一个可能过期的字符串没有意义。
 *
 * 空态文案必须点名分类：筛选后的「还没有」是假的（用户可能有很多文章，只是这个
 * 分类下没有），说清是哪个分类空了并指出怎么退出。
 *
 * 批次 09（资料完整态复查）两处修正，都是「批次 06 的意图没落地」：
 *
 *   1. **混排时补回无封面卡的视觉位**。批次 06 写的是「宁可留白」，代码却写成了
 *      「不渲染」—— 不渲染等于不占位。开发库此前零封面，所以看不出问题；一旦同一
 *      行里既有带封面的卡又有不带的，无封面那张的标题会顶到卡片上沿。实测 1440px
 *      下带封面的标题在 y=170.1，不带封面的在 y=17，差 153px，而两张卡的底边
 *      （分类 chip + 元信息，由 `mt-auto` 贴底）却对齐 —— 整行读起来像漏了一张图。
 *      现在改成**条件渲染**：列表里只要存在一张带封面的卡，无封面的也出
 *      `ContentVisual` 的装饰板，让标题落在同一基线；整片都没有封面时仍然不渲染
 *      （那才是批次 06 想避免的「一片占位符」，此时所有卡都没有顶部块，本来就是对
 *      齐的）。
 *      用装饰板而不是空白占位，是因为一块 141px 高、什么内容都没有的白，与「图片
 *      加载失败」在视觉上无法区分；装饰板至少说明「这篇是纯文字内容」。
 *
 *   2. **hover 阴影从空转改成真的抬升**。`Card` 基类自带 `shadow-sm`，原来的
 *      `hover:shadow-sm` 与原值完全相同，`transition-[border-color,box-shadow]` 里
 *      的 box-shadow 分支永远跑不出差别 —— 卡片 hover 实际只有边框在升温。改
 *      `hover:shadow-md`（`0 2px 6px -1px`，比基类深一档）。
 *      注：`components/shared/ContentCard.tsx` 有同一处空转，属全站共享组件，
 *      本轮未动。
 */

/** A count that is only worth drawing when it says something. */
function WorkMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Heart;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} 次${label}`}>
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function WorkMetaRow({ work }: { work: SpaceWorkItem }) {
  const published = formatFullDate(work.publishedAt);
  /* 0 与缺失同义：都没有可说的信息。`viewCount` 不在这里，它恒为 0。 */
  const likes = typeof work.likeCount === "number" && work.likeCount > 0 ? work.likeCount : null;
  const bookmarks =
    typeof work.bookmarkCount === "number" && work.bookmarkCount > 0 ? work.bookmarkCount : null;

  if (!published && !likes && !bookmarks) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground">
      {published ? <span className="tabular-nums">{published}</span> : null}
      {likes ? <WorkMetric icon={Heart} value={likes} label="点赞" /> : null}
      {bookmarks ? <WorkMetric icon={Bookmark} value={bookmarks} label="收藏" /> : null}
    </div>
  );
}

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

  /* 混排时才给无封面的卡补装饰板：整片都没有封面时，所有卡的标题本来就在同一
     基线上，补板反而制造出批次 06 想避免的「一片占位符」。 */
  const hasAnyCover = works.works.some((work) => Boolean(work.coverUrl));

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
      /* 等高网格，剩余空间落在摘要与「分类 + 元信息」之间。
         试过 `items-start`（按内容高度排列）：卡片内部是紧凑了，但网格第二行会
         从上一行最高卡片的下沿开始，实测 1440px 下第二行被推到 580px 处，中间留下
         一个跨两列的空洞 —— 比等高的空白更糟。作品流是要顺着往下扫的，断开的行
         会让读者以为列表结束了。
         等高之后，内容少的那张卡片在摘要下方多出空白，这是卡片网格的常规代价；
         把「分类 + 元信息」用 `mt-auto` 贴底，空白就落在阅读顺序的末尾，不打断
          标题→摘要→元信息的连续。 */
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
            <Card className="h-full transition-[border-color,box-shadow] hover:border-accent-line hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                {work.coverUrl || hasAnyCover ? (
                  <ContentVisual
                    stableKey={work.id}
                    objectType="ARTICLE"
                    cover={work.coverUrl ?? undefined}
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
                </div>

                {/*
                  分类 chip 与元信息组成一个贴底的内容组（`mt-auto` 在组上，不在组内
                  某一项上）。放在组内单项上会让被同行拉高的卡片把它们撕成两半 ——
                  chip 紧跟摘要、元信息贴底，中间空出一大片。网格等高卡片必然要分配
                  剩余空间，剩下的那一段应该留在摘要与「chip + 元信息」之间。
                */}
                <div className="mt-auto flex flex-col gap-2">
                  {categoryLabel ? (
                    <span className="w-fit rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium leading-4 text-accent-strong">
                      {categoryLabel}
                    </span>
                  ) : null}
                  <WorkMetaRow work={work} />
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
