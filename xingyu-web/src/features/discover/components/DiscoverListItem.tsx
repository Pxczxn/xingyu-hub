import * as Accordion from "@radix-ui/react-accordion";
import type { ContentSummary } from "@/api/common.types";
import { Link } from "react-router-dom";
import { useState, useEffect, useId, useRef, useLayoutEffect } from "react";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentCoverImage } from "@/components/shared/OptimizedImage";
import { cn } from "@/lib/cn";
import { BookOpen, Users, Heart, MessageSquare, Clock, Loader2 } from "lucide-react";
import { articlesApi } from "@/api/articles/articles.api";
import { seriesApi } from "@/api/series/series.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import type { CommentItem } from "@/api/interactions/interactions.types";
import { useAuth } from "@/features/auth/auth.store";
import { DiscoverReadingPanel } from "./DiscoverReadingPanel";

/*
 * DiscoverListItem - 探索页面内容列表项
 * 
 * 支持展开/收起：展开时加载正文和评论
 */

interface DiscoverListItemProps {
  item: ContentSummary;
  variant?: "normal" | "compact" | "expanded";
  onToggleExpand: () => void;
  className?: string;
}

export function DiscoverListItem({ item, variant = "normal", onToggleExpand, className }: DiscoverListItemProps) {
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
  const [detailContent, setDetailContent] = useState<ArticleDetail | PublicSeriesDetail | null>(null);
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
    request.then((content) => {
      if (active) setDetailContent(content);
    }).catch(() => {
      if (active) setError("加载内容失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
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
    request.then((items) => { if (active) setComments(items); })
      .catch(() => { if (active) setCommentsError(true); })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [isExpanded, item.id, isSeriesType, isAuthenticated]);

  useLayoutEffect(() => {
    if (!isExpanded) return;
    const trigger = triggerRef.current;
    const row = trigger?.closest<HTMLElement>("[data-discover-variant]");
    const header = row?.querySelector<HTMLElement>("[data-reading-toolbar]");
    if (!trigger || !row || !header) return;
    const shellHeader = document.querySelector<HTMLElement>("header.sticky");
    const measure = () => {
      const viewport = row.querySelector<HTMLElement>("[data-reading-viewport], .discover-reading-placeholder");
      if (!viewport) return;
      // Match the existing reading-position inset, then leave one spacing unit
      // below the viewport. Header wrapping, not an assumed title height, owns it.
      const inset = (shellHeader?.getBoundingClientRect().height ?? 0)
        + (parseFloat(getComputedStyle(row).paddingTop) || 0)
        + viewport.getBoundingClientRect().top - trigger.getBoundingClientRect().top + 16;
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
      const omega = 2 / smoothTime;
      const x = omega * dt;
      const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const change = heightRef.current - target;
      const temp = (velocity + omega * change) * dt;
      velocity = (velocity - omega * temp) * decay;
      const next = target + (change + temp) * decay;
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
        "discover-row group relative block px-4 sm:px-6",
        isCompact || isExpanded ? "py-3" : "py-5",
        isExpanded && "bg-muted/20 before:opacity-100",
        "hover:bg-gradient-to-r hover:from-muted/40 hover:to-transparent",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-accent before:opacity-0 before:transition-opacity before:duration-200",
        "hover:before:opacity-100",
        className,
      )}
    >
      <div data-reading-toolbar={isExpanded || undefined} className={cn("discover-item-header", isExpanded && "discover-reading-toolbar rounded-lg bg-background/95")}>
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
        className="min-w-0 cursor-pointer rounded-sm focus-ring"
      >
      {/* 折叠内容 */}
      <div className="flex gap-4">
        {/* 左侧封面图（如果有） */}
        {hasCover && item.cover ? (
          <div
            className="discover-cover relative shrink-0 overflow-hidden rounded-xl ring-1 ring-border/50"
            aria-hidden
          >
            <ContentCoverImage
              src={item.cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {/* 渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
          </div>
        ) : null}

        {/* 右侧内容 */}
        <div className="min-w-0 flex-1">
          {/* 元信息行 */}
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", isCompact || isExpanded ? "mb-1" : "mb-2.5")}>
            {/* 作者 */}
            {item.authorName ? (
              <>
                <span className="flex min-w-0 max-w-full items-center gap-1 font-medium text-foreground transition-colors group-hover:text-accent-strong">
                  <svg
                    className="h-3 w-3 shrink-0 opacity-60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle cx="12" cy="8" r="4" strokeWidth="2" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 20c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6"
                    />
                  </svg>
                  <span className="truncate">{item.authorName}</span>
                </span>
                <span className="text-border" aria-hidden>·</span>
              </>
            ) : null}
            
            {/* 内容类型标签 */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all",
                isSeriesType
                  ? "bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20 dark:bg-purple-400/10 dark:text-purple-400"
                  : "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400",
              )}
            >
              {isSeriesType ? (
                <>
                  <Users className="h-3 w-3" aria-hidden />
                  系列
                </>
              ) : (
                <>
                  <BookOpen className="h-3 w-3" aria-hidden />
                  文章
                </>
              )}
            </span>

            {/* 更新时间 */}
            {item.updatedAt ? (
              <>
                <span className="text-border" aria-hidden>·</span>
                <time
                  dateTime={item.updatedAt}
                  className="flex items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground"
                >
                  <Clock className="h-3 w-3" aria-hidden />
                  {new Date(item.updatedAt).toLocaleDateString("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </time>
              </>
            ) : null}
          </div>

          {/* 标题 */}
          <h3 className={cn("text-lg font-bold leading-7 text-foreground transition-colors duration-200 group-hover:text-accent-strong", isExpanded ? "mb-1 break-words [overflow-wrap:anywhere] md:text-xl md:leading-8" : isCompact ? "mb-0 line-clamp-2" : "mb-2.5 line-clamp-2 md:text-xl md:leading-8")}>
            {item.title}
          </h3>

          {/* 摘要 */}
          {item.summary ? (
            <div className="discover-summary" aria-hidden={isCompact || isExpanded}>
              <div className="min-h-0 overflow-hidden">
                <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">
                  {item.summary}
                </p>
              </div>
            </div>
          ) : null}

          {/* 统计信息 */}
          <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", isCompact && "hidden")}>
            {item.likeCount !== undefined ? (
              <span className="flex items-center gap-1.5 transition-colors hover:text-accent-strong">
                <Heart className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums">{item.likeCount} 赞</span>
              </span>
            ) : null}
            {item.commentCount !== undefined ? (
              <span className="flex items-center gap-1.5 transition-colors hover:text-accent-strong">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums">{item.commentCount} 评论</span>
              </span>
            ) : null}
            {item.readMinutes !== undefined && item.readMinutes > 0 ? (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {item.readMinutes} 分钟
              </span>
            ) : null}
          </div>
        </div>
      </div>
      </div>
      {isExpanded && <button type="button" onClick={() => {
        onToggleExpand();
        triggerRef.current?.focus({ preventScroll: true });
      }} className="focus-ring min-h-11 shrink-0 self-start rounded-md border border-accent-line/70 bg-accent-soft px-3 text-sm text-accent-strong transition-colors hover:bg-accent/15">收起阅读</button>}
      </div>

      <Accordion.Content id={panelId} aria-labelledby={`${panelId}-trigger`} aria-hidden={!isExpanded} inert={!isExpanded} className="discover-panel">
        <div ref={panelClipRef} className="discover-panel-clip">
        <div ref={panelContentRef} className="discover-panel-content space-y-3 rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 to-muted/20 p-2 shadow-sm">
          <div className="discover-reader min-w-0">
            {loading || (!detailContent && !error) ? (
              <div role="status" className="discover-reading-body discover-reading-placeholder flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : error ? (
              <div className="discover-reading-body discover-reading-placeholder space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p role="alert" className="text-sm text-destructive">{error}</p>
                <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="focus-ring min-h-11 rounded px-2 text-sm text-accent-strong">重新加载正文</button>
              </div>
            ) : detailContent && <DiscoverReadingPanel content={detailContent} />}
            <div className="discover-reading-actions flex justify-end">
              <Link to={href} className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground">查看详情</Link>
            </div>
          </div>

            <section aria-label="评论预览" className="rounded-lg border border-border/60 bg-card p-3">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" aria-hidden />
                {isAuthenticated ? `评论 (${comments.length})` : "评论预览"}
              </h4>
              {commentsLoading ? <p role="status" className="text-sm text-muted-foreground">评论加载中...</p>
                : commentsError ? <p role="alert" className="text-sm text-destructive">评论加载失败，请稍后重试。</p>
                : comments.length === 0 ? <p className="text-sm text-muted-foreground">暂无评论</p>
                : <>
                  <ul className="grid gap-3 xl:grid-cols-3">
                    {comments.slice(0, 3).map((comment) => <li key={comment.id} className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{comment.authorUsername || "匿名用户"}</span>
                        <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</time>
                      </div>
                      <p className="line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">{comment.body}</p>
                    </li>)}
                  </ul>
                  {comments.length > 3 && <p className="mt-2 text-xs text-muted-foreground">还有 {comments.length - 3} 条评论...</p>}
                </>}
              {!isAuthenticated && !commentsLoading && !commentsError && (
                <Link to="/login" className="focus-ring mt-2 inline-flex min-h-11 items-center rounded text-sm text-accent-strong">登录查看全部评论</Link>
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
