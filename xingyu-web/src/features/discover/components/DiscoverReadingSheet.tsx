import { useEffect, useId, useState } from "react";
import { useAuth } from "@/features/auth/auth.store";
import { articlesApi } from "@/api/articles/articles.api";
import { seriesApi } from "@/api/series/series.api";
import { momentsApi } from "@/api/moments/moments.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import type { MomentView } from "@/api/moments/moments.types";
import type { CommentItem } from "@/api/interactions/interactions.types";
import type { ContentSummary } from "@/api/common.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiscoverReadingPanel } from "./DiscoverReadingPanel";
import { DiscoverMomentPanel } from "./DiscoverMomentPanel";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { contentHref } from "@/components/shared/ContentCard";
import { buildLoginPath } from "@/features/auth/login-return-path";
import { formatDateTime } from "@/lib/relative-time";
import { cn } from "@/lib/cn";

interface DiscoverReadingSheetProps {
  item: ContentSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscoverReadingSheet({ item, open, onOpenChange }: DiscoverReadingSheetProps) {
  const { isAuthenticated } = useAuth();
  const [detailContent, setDetailContent] = useState<
    ArticleDetail | PublicSeriesDetail | MomentView | null
  >(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const commentsSectionId = useId();

  const isSeriesType = item?.objectType === "SERIES";
  const isMomentType = item?.objectType === "MOMENT";

  // Load detail content
  useEffect(() => {
    if (!open || !item) {
      setDetailContent(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setDetailContent(null);

    const request = isMomentType
      ? momentsApi.getById(item.id)
      : isSeriesType
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
  }, [open, item?.id, isSeriesType, isMomentType, retryKey]);

  // Load comments
  useEffect(() => {
    if (!open || !item) {
      setComments([]);
      return;
    }

    setComments([]);
    setCommentsError(false);

    if (!isAuthenticated && isMomentType) {
      setCommentsLoading(false);
      return;
    }

    let active = true;
    setCommentsLoading(true);

    const objectType = isMomentType ? "MOMENT" : isSeriesType ? "SERIES" : "ARTICLE";
    const request = isAuthenticated
      ? interactionsApi.getComments(objectType, item.id)
      : interactionsApi.getCommentPreview(objectType, item.id);

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
  }, [open, item?.id, item?.objectType, isAuthenticated, isMomentType, isSeriesType, retryKey]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,95vw)] max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>

        {/* 头部信息栏 */}
        {!loading && !error && detailContent && (
          <div className="border-b bg-muted/30 px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="mb-2 text-xl font-bold leading-tight text-foreground md:text-2xl">
                  {item.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {item.authorName && (
                    <span className="font-medium text-foreground/80">
                      {item.authorName}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      item.objectType === "SERIES"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-muted-foreground/10 text-muted-foreground",
                    )}
                  >
                    {item.objectType === "SERIES" ? "系列" : item.objectType === "MOMENT" ? "动态" : "文章"}
                  </span>
                  {item.updatedAt && (
                    <time className="text-xs" dateTime={item.updatedAt}>
                      {formatDateTime(item.updatedAt)}
                    </time>
                  )}
                </div>
              </div>
              <Link
                to={contentHref(item)}
                className="shrink-0 text-sm font-medium text-accent-strong hover:underline"
              >
                查看详情 →
              </Link>
            </div>
          </div>
        )}

        {/* 内容区域带滚动 */}
        <div className="overflow-y-auto">
          <div className="px-6 py-6 md:px-8 md:py-8">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>
                  重试
                </Button>
              </div>
            )}

            {!loading && !error && detailContent && (
              <div>
                {/* 正文内容 */}
                <div className="mb-8">
                  {isMomentType ? (
                    <DiscoverMomentPanel moment={detailContent as MomentView} />
                  ) : (
                    <DiscoverReadingPanel
                      content={detailContent as ArticleDetail | PublicSeriesDetail}
                    />
                  )}
                </div>

                {/* 评论区 */}
                <div id={commentsSectionId} className="rounded-xl border bg-muted/20 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-lg font-semibold">
                      <MessageSquare className="h-5 w-5 text-accent-strong" aria-hidden />
                      {isAuthenticated ? `评论 ${comments.length}` : "评论预览"}
                    </h4>
                    {comments.length > 0 && (
                      <Link
                        to={contentHref(item)}
                        className="text-sm font-medium text-accent-strong hover:underline"
                      >
                        查看全部 →
                      </Link>
                    )}
                  </div>

                  {!isAuthenticated && isMomentType ? (
                    <div className="rounded-lg bg-background p-8 text-center shadow-sm">
                      <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                      <p className="mb-4 text-sm text-muted-foreground">
                        动态评论需要登录后查看
                      </p>
                      <Link
                        to={buildLoginPath(window.location.pathname)}
                        className="inline-flex min-h-11 items-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                      >
                        去登录
                      </Link>
                    </div>
                  ) : commentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">加载评论...</span>
                    </div>
                  ) : commentsError ? (
                    <div className="rounded-lg bg-destructive/5 p-8 text-center">
                      <p className="mb-4 text-sm text-destructive">加载评论失败</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRetryKey((k) => k + 1)}
                      >
                        重试
                      </Button>
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="rounded-lg bg-background py-12 text-center">
                      <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">还没有评论，来说两句吧</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-lg bg-background p-4 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="mb-2.5 flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                              {(comment.authorUsername || "?")[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {comment.authorUsername || "匿名用户"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="pl-9 text-sm leading-relaxed text-foreground/90">
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
