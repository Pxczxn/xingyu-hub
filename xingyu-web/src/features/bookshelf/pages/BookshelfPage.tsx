import { useEffect, useState } from "react";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import type { BookshelfCard } from "@/api/bookshelf/bookshelf.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { formatMonthDay, formatRelativeTime } from "@/lib/relative-time";

/*
 * 我的书架 — SK6 信息流 · H 线 / D 紧 / R 齐（A §3 `/me/*` 表内 Bookshelf 行）。
 *
 * 为什么这一页是模板页，以及模板页意味着什么
 * ------------------------------------------
 * `/me/*` 域 21 页里有 11 页是同形的「时间序行式列表」。这 11 页此前共用一个
 * 骨架：一个 `section-gap` + 手写 `text-2xl` h1 + 一列 `rounded-xl border p-4`
 * 的卡面 —— 同一套栅格换 padding，正是 A §2 要消除的雷同。所以这一页先落成
 * 可复制的形状，剩下 10 页按同一组接口搬：
 *
 *   SK6 解剖 `[1fr 行式流 | 300 右栏]`。栅格由 `ArchetypeFrame` 按原型给出，
 *   页面不再自己写 `max-w-*`；右栏由 `SectionRail`（frame 内建）粘住。
 *   H=线：页头是 `PageMasthead` —— 无面、无边框、标题贴内容列左缘，首屏由第一
 *   条开始。原来那个 `text-2xl` 手写 h1（A §4 点名的 30 处之一）就此收敛。
 *   D=紧：条目是「行」不是「格」。`FeedRow` 自带发丝线分隔、无卡面、无逐项
 *   padding 边框；与 SK2 的等权卡格同一批数据、不同构图。
 *   R=齐：主列内所有区块（masthead / 状态块 / 行流）共用一条左缘、同一宽度，
 *   没有出血带、没有偏移块；右栏是 SK6 原型自带的轨，不是页面自己的错位。
 *
 * 右栏两块信息：`书架概览`（在架系列数 + 最近更新时间）与 `最近更新`（按
 * `updatedAt` 取前三条）。两块都只用本页已有的 `BookshelfCard` 字段派生，
 * 不新增 api 文件、不加请求、不引入假的阅读进度类指标（本页没有这类数据）。
 *
 * 行为未变：数据获取（`bookshelfApi.list()`）、错误重试、空态、加载态逐条保留。
 * 条目仍然不可点 —— `BookshelfCard` 没有详情路由可跳，给它 `card-lift` 会宣传
 * 一个不存在的目标，所以行内不放 `<Link>`，也不做整行 hover 抬升。
 */

/** 类型标签：本页只订阅系列，`objectType` 缺省即按系列处理。 */
function objectTypeLabel(item: BookshelfCard): string {
  if (!item.objectType || item.objectType === "SERIES") return "系列";
  return item.objectType;
}

/** 「MM/DD」+ 粗细粒度并列的更新时间；字段缺失或不可解析时不渲染。 */
function updatedDay(item: BookshelfCard): string | null {
  return formatMonthDay(item.updatedAt);
}

export function BookshelfPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<BookshelfCard[]>([]);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    bookshelfApi
      .list()
      .then((page) => {
        if (!active) return;
        setItems(page.items ?? []);
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

  const hasItems = !loading && !error && items.length > 0;

  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead title="我的书架" description="已订阅的系列会出现在这里。" />
      }
      /*
       * 右栏只在真正有内容时出现：两块都是对 `items` 的派生统计，空态下它只能
       * 复述「0 个系列」，与空态文案重复，还会让加载完成时多一次布局跳动。
       * 无 rail 时 frame 自动退回单列（`SOLO.SK6`），行流仍占满内容列。
       */
      rail={hasItems ? <BookshelfRail items={items} /> : null}
      /* landmark 名与两块面板标题不同名，否则同一句话在无障碍树里出现两次。 */
      railLabel="书架侧栏"
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
          title="暂时还没有订阅的系列"
          description="订阅系列后会显示在书架中。"
        />
      ) : null}
      {hasItems ? (
        <ul className="flex flex-col">
          {items.map((item) => {
            const day = updatedDay(item);
            return (
              <FeedRow
                key={item.id}
                /*
                 * 只有真实封面才给缩略图。没有封面的条目是纯文本行 —— 与 Home
                 * 的 feed 同一条判据（`HomeFeedItem.tsx:64`：`if (!item.cover)
                 * return null`），不为了「看起来满」去造一张装饰封面。
                 */
                lead={
                  item.cover ? (
                    <img
                      src={item.cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="hidden h-20 w-[120px] rounded-lg object-cover sm:block"
                    />
                  ) : null
                }
                meta={
                  <>
                    <span>{objectTypeLabel(item)}</span>
                    {day ? (
                      <time dateTime={item.updatedAt ?? undefined} className="tabular-nums">
                        {day}
                      </time>
                    ) : null}
                  </>
                }
              >
                {/* 列表项标题走 h3（B §1：卡片/列表项标题），页头是唯一的 h1。 */}
                <h3 className="text-h3 text-primary">{item.title}</h3>
                {item.summary ? (
                  <p className="mt-1 line-clamp-2 text-meta text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}
                {item.authorName ? (
                  <p className="mt-1 text-meta text-muted-foreground">{item.authorName}</p>
                ) : null}
              </FeedRow>
            );
          })}
        </ul>
      ) : null}
    </ArchetypeFrame>
  );
}

/**
 * 右栏：两块真实信息，全部由本页已取回的 `BookshelfCard[]` 派生。
 *
 * 刻意不放「阅读进度 / 年度目标 / 想读-在读-已读」这类书架页常见的装饰统计：
 * 后端没有返回这些字段，编一组数字就是假数据（该页测试也钉住了这一点）。
 * 这里的两个数字和三条标题都是可从 `items` 复核的事实。
 */
function BookshelfRail({ items }: { items: BookshelfCard[] }) {
  const latest = [...items]
    .sort((a, b) => updatedAtMs(b.updatedAt) - updatedAtMs(a.updatedAt))
    .slice(0, 3);
  const newestLabel = formatRelativeTime(latest[0]?.updatedAt);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="bookshelf-rail-overview"
        className="rounded-xl border border-border/70 bg-card p-4"
      >
        <h2 id="bookshelf-rail-overview" className="text-h3 text-primary">
          书架概览
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-caption text-muted-foreground">在架系列</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums text-primary">
              {items.length}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">最近更新</dt>
            <dd className="mt-1 text-meta text-foreground-soft">{newestLabel ?? "暂无记录"}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="bookshelf-rail-latest"
        className="rounded-xl border border-border/70 bg-card p-4"
      >
        <h2 id="bookshelf-rail-latest" className="text-h3 text-primary">
          最近更新
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {latest.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              {/* 不用标题元素：行流里那条 h3 才是条目的标题，右栏这里是同一条目的
                  索引副本，重复成一个标题会让「星语长篇」在无障碍树里出现两次。 */}
              <span className="min-w-0 truncate text-meta text-foreground-soft">
                {item.title}
              </span>
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                {formatMonthDay(item.updatedAt) ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** 排序用的时间戳；缺失或不可解析一律当 0，让它们排到最后。 */
function updatedAtMs(value?: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
