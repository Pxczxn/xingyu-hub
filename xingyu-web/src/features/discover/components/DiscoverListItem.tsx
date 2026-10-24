import * as Accordion from "@radix-ui/react-accordion";
import type { ContentSummary } from "@/api/common.types";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useId, useRef, useLayoutEffect } from "react";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentCoverImage } from "@/components/shared/OptimizedImage";
import { cn } from "@/lib/cn";
import { Heart, MessageSquare, Clock, Loader2 } from "lucide-react";
import { articlesApi } from "@/api/articles/articles.api";
import { seriesApi } from "@/api/series/series.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import type { CommentItem } from "@/api/interactions/interactions.types";
import { useAuth } from "@/features/auth/auth.store";
import { buildLoginPath } from "@/features/auth/login-return-path";
import { smoothDamp } from "../smooth-damp";
import { DiscoverReadingPanel } from "./DiscoverReadingPanel";

/*
 * DiscoverListItem - 探索页面内容列表项
 *
 * 支持展开/收起：展开时加载正文和评论
 */

/** Per-paint ceiling for the panel height, matching the scroll loop's budget. */
const MAX_HEIGHT_STEP = 24;

interface DiscoverListItemProps {
  item: ContentSummary;
  variant?: "normal" | "compact" | "expanded";
  onToggleExpand: () => void;
  className?: string;
}

export function DiscoverListItem({
  item,
  variant = "normal",
  onToggleExpand,
  className,
}: DiscoverListItemProps) {
  const location = useLocation();
  const panelId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelClipRef = useRef<HTMLDivElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(0);
  const [retryKey, setRetryKey] = useState(0);
  const { isAuthenticated } = useAuth();
  const [commentsError, setCommentsError] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const isExpanded = variant === "expanded";
  const isCompact = variant === "compact";
  const [detailContent, setDetailContent] = useState<ArticleDetail | PublicSeriesDetail | null>(
    null,
  );
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = contentHref(item);
  const hasCover = Boolean(item.cover);
  const isSeriesType = item.objectType === "SERIES";

  // Public content and comments have independent failure states.
  useEffect(() => {
    if (!isExpanded) return;
    let active = true;
    setLoading(true);
    setError(null);
    setDetailContent(null);
    const request = isSeriesType
      ? seriesApi.getPublicById(item.id)
      : articlesApi.getArticle(item.id);
    request
      .then((content) => {
        if (active) setDetailContent(content);
      })
      .catch(() => {
        if (active) setError("加载内容失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isExpanded, item.id, isSeriesType, retryKey]);

  useEffect(() => {
    if (!isExpanded) return;
    setComments([]);
    setCommentsError(false);
    let active = true;
    setCommentsLoading(true);
    const request = isAuthenticated
      ? interactionsApi.getComments(isSeriesType ? "SERIES" : "ARTICLE", item.id)
      : interactionsApi.getCommentPreview(isSeriesType ? "SERIES" : "ARTICLE", item.id);
    request
      .then((items) => {
        if (active) setComments(items);
      })
      .catch(() => {
        if (active) setCommentsError(true);
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isExpanded, item.id, isSeriesType, isAuthenticated]);

  useLayoutEffect(() => {
    if (!isExpanded) return;
    const trigger = triggerRef.current;
    const row = trigger?.closest<HTMLElement>("[data-discover-variant]");
    const header = row?.querySelector<HTMLElement>("[data-reading-toolbar]");
    if (!trigger || !row || !header) return;
    const shellHeader = document.querySelector<HTMLElement>("header.sticky");
    const measure = () => {
      const viewport = row.querySelector<HTMLElement>(
        "[data-reading-viewport], .discover-reading-placeholder",
      );
      if (!viewport) return;
      // Match the existing reading-position inset, then leave one spacing unit
      // below the viewport. Header wrapping, not an assumed title height, owns it.
      const inset =
        (shellHeader?.getBoundingClientRect().height ?? 0) +
        (parseFloat(getComputedStyle(row).paddingTop) || 0) +
        viewport.getBoundingClientRect().top -
        trigger.getBoundingClientRect().top +
        16;
      row.style.setProperty("--discover-reading-top", `${inset}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (shellHeader) observer.observe(shellHeader);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      row.style.removeProperty("--discover-reading-top");
    };
  }, [isExpanded, loading, error, detailContent]);

  /*
   * The accordion animates the panel's block height, and the panel's content is
   * replaced twice: the loading placeholder returns, then the body and comments
   * arrive. Radix measures the open height exactly once, so animating toward that
   * measurement ends with a hard snap when the real content is shorter. Track the
   * live content height instead and animate towards it; an asynchronous body or
   * comment retargets the same motion instead of replacing it.
   */
  useLayoutEffect(() => {
    const clip = panelClipRef.current;
    const content = panelContentRef.current;
    if (!clip || !content) return;
    // Narrow layouts keep the natural height (discover.css): animating a document
    // that can be tens of thousands of pixels tall repeatedly clamps the scroll.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      clip.style.removeProperty("height");
      return;
    }
    const targetOf = () => (isExpanded ? content.getBoundingClientRect().height : 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Reduced motion: no height animation at all, only the live size.
      const apply = () => {
        const height = targetOf();
        heightRef.current = height;
        clip.style.height = `${height}px`;
      };
      apply();
      const observer = new ResizeObserver(apply);
      observer.observe(content);
      return () => observer.disconnect();
    }
    let target = targetOf();
    let frame = 0;
    let last = performance.now();
    // Critically damped, like the surrounding transitions but retargetable: a
    // content height that moves mid-flight bends the same motion instead of
    // restarting it. Starting from rest also keeps the first frame from dropping a
    // few hundred pixels at the very bottom of the page, where the browser has to
    // follow the shrinking document.
    let velocity = 0;
    const smoothTime = 0.11;
    if (isExpanded) {
      heightRef.current = 0;
      clip.style.height = "0px";
    }
    const tick = (now: number) => {
      // Read the live height every frame: React swaps the placeholder for the real
      // body/comments between frames, and a stale target would overshoot.
      target = targetOf();
      const dt = Math.min(64, Math.max(0, now - last)) / 1000;
      last = now;
      const damped = smoothDamp(heightRef.current, target, velocity, smoothTime, dt);
      velocity = damped.velocity;
      // One paint may not travel more than this. A long frame (a commit, a decode)
      // hands the spring a large dt and a critical spring covers a fixed fraction
      // of the remaining distance, so an uncapped step turns a slow collapse into
      // a visible snap — the live height is measured per frame, so the ceiling
      // costs no fidelity: the next paint simply continues from here.
      const wanted = damped.value - heightRef.current;
      const next =
        Math.abs(wanted) > MAX_HEIGHT_STEP
          ? heightRef.current + Math.sign(wanted) * MAX_HEIGHT_STEP
          : damped.value;
      heightRef.current = next;
      clip.style.height = `${next}px`;
      if (Math.abs(target - next) < 0.5) {
        heightRef.current = target;
        velocity = 0;
        clip.style.height = `${target}px`;
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    kick();
    const observer = new ResizeObserver(() => {
      if (!isExpanded) return;
      target = targetOf();
      kick();
    });
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
    };
  }, [isExpanded]);

  const handleClick = (e: React.MouseEvent) => {
    // 切换展开/收起状态
    e.preventDefault();
    onToggleExpand();
  };

  return (
    <Accordion.Root type="single" value={isExpanded ? "reading" : ""} collapsible asChild>
      <Accordion.Item value="reading" asChild>
        <div
          data-discover-variant={variant}
          className={cn(
            "discover-row group relative block",
            isCompact || isExpanded ? "py-3" : "py-5",
            isExpanded && "bg-muted/20",
            className,
          )}
        >
          <div
            data-reading-toolbar={isExpanded || undefined}
            className={cn(
              "discover-item-header",
              isExpanded
                ? "discover-reading-toolbar rounded-lg bg-background/95"
                : "flex items-start justify-between gap-5",
            )}
          >
            {/* 可点击区域 - 展开/收起；收起按钮保持为其独立的同级控件。 */}
            <div
              ref={triggerRef}
              id={`${panelId}-trigger`}
              onClick={handleClick}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              data-discover-trigger
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleExpand();
                }
              }}
              className="min-w-0 flex-1 cursor-pointer rounded-sm focus-ring"
            >
              {/* 折叠内容 */}
              <div className="flex gap-4">
                {/*
                 * 封面退到右侧、只在真有封面时出现。
                 *
                 * 视觉稿是纯文字流（样图里所有行都没有封面），但 cover 是服务端
                 * 真实字段而不是装饰，删掉展示能力等于功能退化。放在标题之后、
                 * 与文字列并排，没有封面时这一列不存在，行的左边缘不会因为
                 * 「有的行有图、有的行没有」而错位。
                 */}
                {/* 右侧内容 */}
                <div className="min-w-0 flex-1">
                  {/*
                   * 署名行：字母头像 + 作者 · 类型 · 日期，一条线读到底。
                   *
                   * 视觉稿把这一行压成 12px 的连续文本（头像 24px），比原来
                   * 「人形图标 + 蓝紫胶囊 + 时钟图标」轻得多：三个图标同权重时
                   * 每一行都在抢标题的注意力。类型仍然用胶囊区分，只是改成中性
                   * 灰/淡紫，让「系列」与「文章」一眼可辨但不刺眼。
                   *
                   * 没有作者时整块不渲染，行首直接是类型与日期 —— 不留空头像位。
                   */}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
                      isCompact || isExpanded ? "mb-1" : "mb-2.5",
                    )}
                  >
                    {item.authorName ? (
                      <>
                        <span
                          aria-hidden
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                        >
                          {item.authorName.slice(0, 1)}
                        </span>
                        <span className="min-w-0 max-w-full truncate font-medium text-foreground/80 transition-colors group-hover:text-foreground">
                          {item.authorName}
                        </span>
                        <span className="text-border" aria-hidden>
                          ·
                        </span>
                      </>
                    ) : null}

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-[7px] px-2 py-0.5 text-[11px] font-medium",
                        isSeriesType
                          ? "bg-[hsl(272_44%_95%)] text-[hsl(270_28%_53%)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isSeriesType ? "系列" : "文章"}
                    </span>

                    {item.updatedAt ? (
                      <>
                        <span className="text-border" aria-hidden>
                          ·
                        </span>
                        <time
                          dateTime={item.updatedAt}
                          className="shrink-0 text-[11px] tabular-nums text-muted-foreground/75"
                        >
                          {new Date(item.updatedAt).toLocaleDateString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                          })}
                        </time>
                      </>
                    ) : null}
                  </div>

                  {/* 标题 */}
                  <h3
                    className={cn(
                      "font-bold text-foreground transition-colors duration-200 group-hover:text-accent-strong",
                      // 标题字距按视觉稿收到 -0.5px：19px 下 -0.01em 只有 -0.19px，
                      // 中文方块字在 19px 上几乎看不出区别，拉丁字母却明显偏松。
                      isExpanded
                        ? "mb-1 break-words text-[1.1875rem] leading-[1.4] tracking-[-0.5px] [overflow-wrap:anywhere]"
                        : isCompact
                          ? "mb-0 line-clamp-2 text-[1.0625rem] leading-[1.4] tracking-[-0.4px]"
                          : "mb-2 line-clamp-2 text-[1.1875rem] leading-[1.4] tracking-[-0.5px]",
                    )}
                  >
                    {item.title}
                  </h3>

                  {/* 摘要：单行省略，扫读时不会因为两行折行把行高撑开 */}
                  {item.summary ? (
                    <div className="discover-summary" aria-hidden={isCompact || isExpanded}>
                      <div className="min-h-0 overflow-hidden">
                        <p className="mb-3 truncate text-[13px] leading-[1.7] text-muted-foreground/90">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* 统计信息 */}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-[18px] gap-y-1 text-xs text-muted-foreground",
                      isCompact && "hidden",
                    )}
                  >
                    {item.likeCount !== undefined ? (
                      <span className="flex items-center gap-1.5">
                        <Heart className="h-[15px] w-[15px]" aria-hidden />
                        <span className="tabular-nums">{item.likeCount} 赞</span>
                      </span>
                    ) : null}
                    {item.commentCount !== undefined ? (
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-[15px] w-[15px]" aria-hidden />
                        <span className="tabular-nums">{item.commentCount} 评论</span>
                      </span>
                    ) : null}
                    {item.readMinutes !== undefined && item.readMinutes > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-[15px] w-[15px]" aria-hidden />
                        {item.readMinutes} 分钟
                      </span>
                    ) : null}
                  </div>
                </div>

                {/*
                 * 封面缩略图 —— 真有封面时才出现，放在文字列右侧并与行同高。
                 *
                 * 视觉稿的数据全是无封面内容，所以稿子里看不到这一列；但 cover
                 * 是真实字段，去掉展示能力就是功能退化。缩到 96×72 且不做 hover
                 * 放大，有图的行只是多一张小图，没有图的行与稿子完全一致。
                 */}
                {hasCover && item.cover ? (
                  <div
                    className="relative hidden shrink-0 overflow-hidden rounded-lg ring-1 ring-border/50 sm:block"
                    style={{ width: 96, height: 72 }}
                    aria-hidden
                  >
                    <ContentCoverImage
                      src={item.cover}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {isExpanded ? (
              <button
                type="button"
                onClick={() => {
                  onToggleExpand();
                  triggerRef.current?.focus({ preventScroll: true });
                }}
                className="focus-ring min-h-11 shrink-0 self-start rounded-md border border-accent-line/70 bg-accent-soft px-3 text-sm text-accent-strong transition-colors hover:bg-accent/15"
              >
                收起阅读
              </button>
            ) : (
              /*
               * 折叠行只有「展开预览」一条路径时，完整阅读要先展开再找面板底部的入口；
               * 这里给一个常驻的直达入口，键盘与新标签页都能用。
               *
               * 位置按视觉稿放到行右缘、与文字列垂直居中 —— 原来绝对定位在右上角，
               * 会与标题首行抢同一条基线，行高越高越显得悬空。
               */
              <Link
                to={href}
                aria-label={`阅读全文：${item.title}`}
                className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-md pl-3 pr-1 text-[13px] font-semibold text-accent-strong/90 transition-colors hover:text-accent-strong"
              >
                阅读全文
                <span aria-hidden className="text-base font-normal leading-none">
                  ›
                </span>
              </Link>
            )}
          </div>

          <Accordion.Content
            id={panelId}
            aria-labelledby={`${panelId}-trigger`}
            aria-hidden={!isExpanded}
            inert={!isExpanded}
            className="discover-panel"
          >
            <div ref={panelClipRef} className="discover-panel-clip">
              <div
                ref={panelContentRef}
                className="discover-panel-content space-y-3 border-t border-border/60 bg-muted/15 p-4"
              >
                <div className="discover-reader min-w-0">
                  {loading || (!detailContent && !error) ? (
                    <div
                      role="status"
                      className="discover-reading-body discover-reading-placeholder flex items-center justify-center"
                    >
                      <Loader2
                        className="mr-2 h-5 w-5 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                      <span className="text-sm text-muted-foreground">加载中...</span>
                    </div>
                  ) : error ? (
                    <div className="discover-reading-body discover-reading-placeholder space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetryKey((key) => key + 1)}
                        className="focus-ring min-h-11 rounded px-2 text-sm text-accent-strong"
                      >
                        重新加载正文
                      </button>
                    </div>
                  ) : (
                    detailContent && <DiscoverReadingPanel content={detailContent} />
                  )}
                  <div className="discover-reading-actions flex justify-end">
                    <Link
                      to={href}
                      className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground"
                    >
                      查看详情
                    </Link>
                  </div>
                </div>

                <section aria-label="评论预览" className="border-t border-border/60 pt-3">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    {isAuthenticated ? `评论 (${comments.length})` : "评论预览"}
                  </h4>
                  {/*
                   * Comments resolve independently of the body, usually a beat
                   * after it, so they used to appear under an already-settled
                   * panel with no transition. Keying on the state (not on the
                   * text) makes each of the four arrivals — loading, error,
                   * empty, list — enter the same way.
                   */}
                  <div
                    key={
                      commentsLoading
                        ? "comments-loading"
                        : commentsError
                          ? "comments-error"
                          : comments.length === 0
                            ? "comments-empty"
                            : "comments-list"
                    }
                    className="discover-content-in"
                  >
                    {commentsLoading ? (
                      <p role="status" className="text-sm text-muted-foreground">
                        评论加载中...
                      </p>
                    ) : commentsError ? (
                      <p role="alert" className="text-sm text-destructive">
                        评论加载失败，请稍后重试。
                      </p>
                    ) : comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无评论</p>
                    ) : (
                      <>
                        <ul className="grid gap-3 xl:grid-cols-3">
                          {comments.slice(0, 3).map((comment) => (
                            <li key={comment.id} className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {comment.authorUsername || "匿名用户"}
                                </span>
                                <time dateTime={comment.createdAt}>
                                  {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                                </time>
                              </div>
                              <p className="line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
                                {comment.body}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {comments.length > 3 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            还有 {comments.length - 3} 条评论...
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {!isAuthenticated && !commentsLoading && !commentsError && (
                    <Link
                      to={buildLoginPath(`${location.pathname}${location.search}`)}
                      className="focus-ring mt-2 inline-flex min-h-11 items-center rounded text-sm text-accent-strong"
                    >
                      登录查看全部评论
                    </Link>
                  )}
                </section>
              </div>
            </div>
          </Accordion.Content>
        </div>
      </Accordion.Item>
    </Accordion.Root>
  );
}
