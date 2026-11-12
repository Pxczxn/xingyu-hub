import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * 排序轴（纯呈现层）。
 *
 * 公告 DTO 只有 id/title/body/publishedAt，`GET /api/v1/announcements` 也不接受
 * 任何排序或分类参数（`announcements.api.ts:12-15`），所以 SK2 发现带里的「排序条」
 * 只能是**已取回数组上的客户端排序**：不发新请求、不改 loading/error/items 这台
 * 数据状态机，也不碰 api 层。服务端返回的顺序本身是发布时间倒序，默认值
 * （`newest`）对多数数据来说是同一顺序；`Array.prototype.sort` 是稳定排序，
 * 时间相同或无时间（`publishedAt` 可缺）的条目保持服务端原序。
 */
type AnnouncementSort = "newest" | "oldest";

const SORT_OPTIONS: ReadonlyArray<{ value: AnnouncementSort; label: string }> = [
  { value: "newest", label: "最新发布" },
  { value: "oldest", label: "最早发布" },
];

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  const [sort, setSort] = useState<AnnouncementSort>("newest");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    announcementsApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  /* 客户端排序（见文件顶部 SORT_OPTIONS 的注释）：对副本排序，不改 `items`。 */
  const visible = [...items].sort((a, b) => compareByPublishedAt(a, b, sort));

  /*
   * SK2 画廊 · H=幅 / D=松 / R=齐（`.team/design/A-archetypes.md` §3 的 /announcements 行）。
   *
   * 骨架由 `ArchetypeFrame` 决定，页面只声明身份：`skeleton="SK2"` 是画廊原型，
   * `header="banner"` 是 H=幅（有面横幅），`density="loose"` 是 D=松（每项独立卡面、
   * 首屏 ≤3 块）。R=齐 不来自参数 —— SK2 在没有 `rail` 时就是单列、与内容列同宽同边，
   * 所以这里**不**用 `BleedBand`：出血带属于 R=出，本页按映射表是「齐」。
   *
   * 页头换成了 `PageHero`：它自己带 `<h1>`（`PageHero.tsx:123`），页面不再手写标题，
   * 也就不会有第二个标题层级。`className="motif-orbit"` 挂上 B §6 的几何轨道母题
   * （两圈描边伪元素，零图片、零滤镜），给横幅一块「这是横幅」的材料感；徽标与
   * 金色角落仍是 `PageHero` 自己的默认层。原来的「使用指南」链接从页头右侧挪进
   * `actions` 槽（横幅的操作位在描述下方），并补了 `focus-ring`。
   *
   * 发现带 = 横幅 + 排序条，两条都直接坐在页面底上，不套卡面；卡格在它们之下。
   * 排序条是纯客户端的两态（见 SORT_OPTIONS），无数据时整条不渲染 —— 没有可排的
   * 东西时给一条空工具栏只是噪音。
   *
   * 列表行错峰入场：条数由服务端决定，与 /reports、/appeals 同一条判据（固定区块
   * 由 AppLayout 的 `animate-page-enter` 负责，见 EventDetailPage 的注释）。
   * 错峰挂在 `<li>` 上，不挂在 `<Link>` 上 —— 测试断言每张卡内恰好一个 `<p>` 级别的
   * 结构，入场动画不该往卡片内部加任何东西。
   *
   * 等权卡格：`md` 两列、`lg` 三列，间距与卡内 padding 走 `--density-grid-gap` /
   * `--density-card-pad`（`.density-loose` 在 `ArchetypeFrame` 里提供），所以密度
   * 只有一处定义。`li` 用 `flex` + 卡面 `h-full` 让同一行卡片等高；时间用 `mt-auto`
   * 压到卡底，使整行卡片的 meta 落在同一基线 —— 「等权」不只是格子一样宽。
   *
   * 卡片表面仍是 `rounded-card` + `border-border/70`，交互反馈用 `card-lift` ——
   * 整卡都是 `<Link>`，所以抬升说的是真话（方案 §6.2 C：可点击卡片「边框提亮 +
   * 微抬升」）。刻意不叠 `hover:border-accent-line`：`card-lift` 自己的文档写明
   * 「描边从 /70 收到全量，换的是锐度不是色相」，再叠一条金色描边会有两条
   * `border-color` 规则在同一元素上竞争。`focus-ring` 保证键盘用户的焦点可见。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <div className="flex flex-col gap-4">
          <PageHero
            eyebrow="站务公告"
            title="公告中心"
            description="已发布的全站公告汇总于此；点开任一卡片可读全文。"
            className="motif-orbit"
            actions={
              <Link to="/guide" className="focus-ring text-sm text-accent-strong hover:underline">
                使用指南
              </Link>
            }
          />

          {!loading && !error && items.length > 0 ? (
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border/70">
              {/*
                计数在左、排序在右，共用一条 hairline。容器不带下内边距：
                按钮用 `pb-2.5` 自己撑开，于是按钮盒底正好落在容器下边框上，
                `after:-bottom-px` 的金线因此压住灰线（与 TopicDetailPage 的排序条同形）。
                `aria-pressed` 让「当前按哪个排」对辅助技术可读；视觉上由金线表达。
              */}
              <p className="pb-2.5 text-meta text-muted-foreground">
                共 {items.length} 条已发布公告
              </p>
              <div role="group" aria-label="公告排序" className="flex items-center gap-5">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSort(value)}
                    aria-pressed={sort === value}
                    className={cn(
                      "focus-ring relative rounded-none px-1 pb-2.5 text-sm transition-colors",
                      "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:bg-accent after:transition-transform",
                      sort === value
                        ? "font-medium text-primary after:scale-x-100"
                        : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无已发布公告"
          description="有新的已发布公告时会出现在这里。"
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="grid gap-[var(--density-grid-gap)] md:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, index) => (
            <li
              key={item.id}
              className="animate-rise-in flex"
              style={{ animationDelay: staggerDelay(index) }}
            >
              <Link
                to={`/announcements/${encodeURIComponent(item.id)}`}
                className="card-lift focus-ring flex h-full w-full flex-col rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
              >
                {/* 层级：标题 → 正文预览 → 时间。预览只帮读者在标题之外判断要不要点开，
                    不是把每条公告做成文章卡片，所以纯文本、最多两行、无富文本。
                    `break-words` 是移动端 390 宽度的保险：标题里出现长串无空格文本时，
                    三列栅格降级成的单列不能把它顶成横向滚动。 */}
                <h2 className="break-words text-h3 text-primary">{item.title}</h2>
                {announcementPreview(item.body) ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground-soft">
                    {announcementPreview(item.body)}
                  </p>
                ) : null}
                {item.publishedAt ? (
                  <p className="mt-auto pt-3 text-meta text-muted-foreground">
                    {formatPublishedAt(item.publishedAt)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ArchetypeFrame>
  );
}

/*
 * 列表预览用的正文摘要。
 *
 * 直接用公开 DTO 已有的 `body`，**不新增 summary 字段**。
 * 公告正文是纯文本（`whitespace-pre-wrap` 渲染，HTML 不解析），这里把它压成一行：
 * 换行/制表/连续空白折成单空格，避免预览里出现空洞；最多 2 行由 CSS `line-clamp` 负责，
 * 这里不按字符数硬截断（免得多语言下算错），只是把结构压平。
 *
 * 没有 body 时返回空串 —— 列表会整行不渲染预览，而不是留个空段落。
 */
function announcementPreview(body?: string): string {
  if (!body) return "";
  return body.replace(/\s+/g, " ").trim();
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/*
 * 排序比较器（用法见文件顶部 SORT_OPTIONS 的注释）。
 *
 * `publishedAt` 在 DTO 里是可选的，`new Date` 也可能解析失败 —— 这两种都当作
 * 「没有时间」，并且**两个方向都恒定排到末尾**，而不是在「最早发布」时飘到最前：
 * 时间未知的公告不该冒充「很久以前」。两边都缺时间时返回 0，由
 * `Array.prototype.sort` 的稳定性保持服务端原序。
 */
function compareByPublishedAt(a: Announcement, b: Announcement, sort: AnnouncementSort): number {
  const left = publishedTime(a);
  const right = publishedTime(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return sort === "newest" ? right - left : left - right;
}

function publishedTime(item: Announcement): number | null {
  if (!item.publishedAt) return null;
  const time = new Date(item.publishedAt).getTime();
  return Number.isNaN(time) ? null : time;
}
