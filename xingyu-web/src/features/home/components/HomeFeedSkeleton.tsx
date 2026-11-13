import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/*
 * 骨架和信息流卡片同一套结构：头像、标题、两行摘要、底部分隔后的互动条。
 * 外层不再包成一张大卡，避免加载结束时从「一整块」跳成「多张独立卡」。
 */

function HomeFeedItemSkeleton() {
  return (
    <div className="rounded-card border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="mb-2 h-5 w-3/4" />
      <Skeleton className="mb-1 h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-3">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}

export function HomeFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <HomeFeedItemSkeleton key={index} />
      ))}
    </div>
  );
}

export function HomeSidebarSkeleton() {
  return (
    <aside aria-label="加载中" className="flex flex-col gap-6">
      <div className="rounded-card border border-border/60 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border/60 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-8 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function ContinueReadingSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 pb-1 pt-3">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn("w-64 shrink-0")}>
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
