import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/*
 * Home — Web V2 skeleton (Phase 0).
 *
 * This is the single canonical Home. There is no V1/V2 split, no feature toggle
 * and no Home API call: every region below is a static placeholder that marks
 * where the real feed will land.
 *
 * Recognisable future regions:
 *   1. 社区公告 (announcements)
 *   2. 关注更新 (following updates)
 *   3. 继续阅读 (continue reading)
 *   4. 为你推荐 (recommended for you)
 *   5. Discover / Topic 混排 (mixed discovery rail)
 *   6. Sticky sub-nav
 */

const SUB_NAV = [
  { id: "recommend", label: "推荐" },
  { id: "following", label: "关注" },
  { id: "latest", label: "最新" },
];

function PlaceholderCard({ title, lines = 2 }: { title: string; lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded bg-muted" aria-hidden />
        ))}
      </CardContent>
    </Card>
  );
}

export function HomePage() {
  return (
    <div className="section-gap">
      {/* 6. Sticky sub-nav */}
      <nav
        aria-label="首页分区"
        className="sticky top-14 z-20 -mx-4 flex gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6"
      >
        {SUB_NAV.map((item, index) => (
          <span
            key={item.id}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              index === 0
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </span>
        ))}
      </nav>

      {/* 1. 社区公告 */}
      <section aria-labelledby="home-announcements">
        <h2 id="home-announcements" className="mb-3 text-base font-semibold text-primary">
          社区公告
        </h2>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            公告位占位 — 后续接入公告 API。
          </CardContent>
        </Card>
      </section>

      {/* 5. Discover / Topic 混排 */}
      <section aria-labelledby="home-discover">
        <h2 id="home-discover" className="mb-3 text-base font-semibold text-primary">
          发现 · 话题
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceholderCard title="话题卡占位" />
          <PlaceholderCard title="内容卡占位" />
          <PlaceholderCard title="内容卡占位" />
        </div>
      </section>

      {/* 2. 关注更新 */}
      <section aria-labelledby="home-following">
        <h2 id="home-following" className="mb-3 text-base font-semibold text-primary">
          关注更新
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceholderCard title="关注作者更新占位" />
          <PlaceholderCard title="关注话题更新占位" />
        </div>
      </section>

      {/* 3. 继续阅读 */}
      <section aria-labelledby="home-continue">
        <h2 id="home-continue" className="mb-3 text-base font-semibold text-primary">
          继续阅读
        </h2>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            继续阅读占位 — 后续接入阅读进度。
          </CardContent>
        </Card>
      </section>

      {/* 4. 为你推荐 */}
      <section aria-labelledby="home-recommended">
        <h2 id="home-recommended" className="mb-3 text-base font-semibold text-primary">
          为你推荐
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceholderCard title="推荐内容占位" />
          <PlaceholderCard title="推荐内容占位" lines={3} />
          <PlaceholderCard title="推荐内容占位" />
        </div>
      </section>
    </div>
  );
}
