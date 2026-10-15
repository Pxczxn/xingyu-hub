import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/*
 * HomeFeedSkeleton — 首页内容流加载态
 *
 * 骨架屏设计原则：
 * 1. 保持与真实内容相同的布局结构
 * 2. 避免布局偏移（CLS）
 * 3. 反映内容密度（标题长、摘要短等）
 * 4. 使用语义化的占位元素
 */

/**
 * 单个 Feed 卡片骨架
 */
function HomeFeedItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-6 py-6 px-5 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-3">
        {/* 作者信息行 */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-1" />
          <Skeleton className="h-4 w-12" />
        </div>

        {/* 标题 - 2行 */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>

        {/* 摘要 - 2行 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* 标签 */}
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>

        {/* 互动按钮 */}
        <div className="flex items-center gap-4 pt-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      </div>

      {/* 封面图占位 */}
      <Skeleton className="hidden h-20 w-[120px] shrink-0 rounded-lg sm:block" />
    </div>
  );
}

/**
 * Feed 列表骨架（默认 3 条）
 */
export function HomeFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            index > 0 && "border-t border-border/40",
          )}
        >
          <HomeFeedItemSkeleton />
        </div>
      ))}
    </div>
  );
}

/**
 * 侧边栏模块骨架
 */
export function HomeSidebarSkeleton() {
  return (
    <aside aria-label="加载中" className="flex flex-col gap-4">
      {/* 热门话题骨架 */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 推荐创作者骨架 */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * 继续阅读条骨架
 */
export function ContinueReadingSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 pb-1 pt-3">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-64 shrink-0">
            <div className="flex h-full gap-3 rounded-lg border border-border bg-background p-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
