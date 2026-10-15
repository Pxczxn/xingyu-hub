import type { ContentSummary } from "@/api/common.types";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
  /** Controlled by the page: the list behaves as an accordion, so at most one row is open. */
  expanded: boolean;
  onToggleExpand: () => void;
  className?: string;
}

export function DiscoverListItem({ item, expanded, onToggleExpand, className }: DiscoverListItemProps) {
  const { isAuthenticated } = useAuth();
  const [commentsError, setCommentsError] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const isExpanded = expanded;
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
  }, [isExpanded, item.id, isSeriesType]);

  useEffect(() => {
    setComments([]);
    setCommentsError(false);
    if (!isExpanded) return;
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

  const handleClick = (e: React.MouseEvent) => {
    // 切换展开/收起状态
    e.preventDefault();
    onToggleExpand();
  };

  return (
    <div
      className={cn(
        "group relative block py-5 px-5 sm:px-6",
        "transition-all duration-200 ease-out",
        "hover:bg-gradient-to-r hover:from-muted/40 hover:to-transparent",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-accent before:opacity-0 before:transition-opacity before:duration-200",
        "hover:before:opacity-100",
        className,
      )}
    >
      {/* 可点击区域 - 展开/收起 */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpand();
          }
        }}
        className="cursor-pointer rounded-sm focus-ring"
      >
      {/* 折叠内容 */}
      <div className="flex gap-4">
        {/* 左侧封面图（如果有） */}
        {hasCover && item.cover ? (
          <div
            className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-border/50 transition-all duration-300 group-hover:ring-accent/30 group-hover:shadow-lg"
            style={{ width: 160, height: 120 }}
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
          <div className="mb-2.5 flex items-center gap-2 text-xs">
            {/* 作者 */}
            {item.authorName ? (
              <>
                <span className="flex shrink-0 items-center gap-1 font-medium text-foreground transition-colors group-hover:text-accent-strong">
                  <svg
                    className="h-3 w-3 opacity-60"
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
                  {item.authorName}
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
          <h3 className="mb-2.5 line-clamp-2 text-lg font-bold leading-7 text-foreground transition-all duration-200 group-hover:text-accent-strong md:text-xl md:leading-8">
            {item.title}
          </h3>

          {/* 摘要 */}
          {item.summary ? (
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90 transition-colors group-hover:text-muted-foreground">
              {item.summary}
            </p>
          ) : null}

          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

      {/*
        展开区域是固定高度的面板，本身不滚动：正文、目录、评论各自滚动。
        高度用 max-height 承载，收起动画才有的可插值；h-[600px] 保证展开时
        内容就在最终高度上排版，内部区域不会因为动画而重排。
      */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "mt-4 h-[600px] max-h-[600px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex h-full flex-col rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 to-muted/20 p-5 shadow-sm">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : isExpanded ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {/* 正文与目录 */}
              <div className="min-h-0 flex-[3]">
                {detailContent && (
                  <DiscoverReadingPanel key={`${item.objectType}:${item.id}`} content={detailContent} />
                )}
              </div>

              {/* 评论区 */}
              <div className="flex min-h-0 flex-[2] flex-col rounded-lg border border-border/40 bg-card p-4">
                <h4 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {isAuthenticated ? `评论 (${comments.length})` : "评论预览"}
                </h4>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-none">
                  {commentsLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">评论加载中...</p>
                  ) : commentsError ? (
                    <p role="alert" className="text-sm text-destructive">评论加载失败，请稍后重试。</p>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无评论</p>
                  ) : (
                    <ul className="space-y-3">
                      {comments.slice(0, 3).map((comment) => (
                        <li key={comment.id} className="border-t border-border/40 pt-3 first:border-0 first:pt-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {comment.authorUsername || "匿名用户"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {comment.body}
                          </p>
                        </li>
                      ))}
                      {comments.length > 3 && (
                        <li className="text-sm text-muted-foreground">
                          还有 {comments.length - 3} 条评论...
                        </li>
                      )}
                    </ul>
                  )}
                  {!isAuthenticated && !commentsLoading && !commentsError && (
                    <p className="text-sm text-muted-foreground">
                      <Link to="/login" className="text-accent-strong">登录查看全部评论</Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* 查看详情按钮 */}
          <div className="mt-4 flex shrink-0 items-center justify-end border-t border-border/40 pt-4">
            <Link
              to={href}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent/90 hover:shadow-md focus-ring"
            >
              查看详情
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
