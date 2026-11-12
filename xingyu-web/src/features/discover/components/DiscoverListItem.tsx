import type { ContentSummary } from "@/api/common.types";
import { Link } from "react-router-dom";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentCoverImage } from "@/components/shared/OptimizedImage";
import { cn } from "@/lib/cn";
import { Heart, MessageSquare, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/relative-time";

/*
 * DiscoverListItem - 探索页面内容列表项（卡片模式）
 *
 * 点击"展开预览"按钮会触发父组件打开 Sheet 抽屉显示完整阅读面板
 */

interface DiscoverListItemProps {
  item: ContentSummary;
  onToggleExpand: () => void;
  className?: string;
}

export function DiscoverListItem({
  item,
  onToggleExpand,
  className,
}: DiscoverListItemProps) {
  const href = contentHref(item);
  const hasCover = Boolean(item.cover);

  const typeLabel =
    item.objectType === "SERIES" ? "系列" : item.objectType === "MOMENT" ? "动态" : "文章";

  return (
    <div
      className={cn(
        "discover-row group relative block cursor-pointer py-5 transition-colors hover:bg-muted/30",
        className,
      )}
      onClick={onToggleExpand}
    >
      <div className="discover-item-header flex items-start justify-between gap-5">
        {/* 主要内容区域 */}
        <div className="min-w-0 flex-1">
          <div className="flex gap-4">
            {/* 文字内容列 */}
            <div className="min-w-0 flex-1">
              {/* 署名行：作者 · 类型 · 日期 */}
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {item.authorName ? (
                  <>
                    <span className="font-medium text-foreground/80">
                      {item.authorName}
                    </span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    item.objectType === "SERIES"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {typeLabel}
                </span>
                {item.updatedAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={item.updatedAt}>
                      {formatDateTime(item.updatedAt) || item.updatedAt}
                    </time>
                  </>
                ) : null}
              </div>

              {/* 标题 */}
              <h3 className="mb-1.5 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                {item.title}
              </h3>

              {/* 摘要 */}
              {item.summary ? (
                <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              ) : null}

              {/* 互动数据：赞、评论、阅读时长 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

            {/* 封面缩略图 —— 有封面时才显示 */}
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

        {/* 阅读全文链接 */}
        <Link
          to={href}
          onClick={(e) => e.stopPropagation()}
          aria-label={`阅读全文：${item.title}`}
          className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-md px-3 text-[13px] font-semibold text-accent-strong/90 transition-colors hover:text-accent-strong"
        >
          阅读全文
          <span aria-hidden className="text-base font-normal leading-none">
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
