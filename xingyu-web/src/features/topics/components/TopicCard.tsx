import { Link } from "react-router-dom";
import type { TopicSummary } from "@/api/topics/topics.types";
import { cn } from "@/lib/cn";
import { TopicVisual } from "@/components/visual/TopicVisual";
import { ArrowRight } from "lucide-react";

export function TopicCard({
  topic,
  featured = false,
}: {
  topic: TopicSummary;
  featured?: boolean;
}) {
  return (
    <li>
      <Link
        to={`/topics/${encodeURIComponent(topic.slug)}`}
        className={cn(
          "group focus-ring block h-full transition-colors",
          featured
            ? "min-h-[104px] rounded-lg border border-border/60 bg-card/70 p-3.5 hover:border-accent/55 hover:bg-card"
            : "rounded-md border-b border-border/60 bg-transparent p-4 hover:bg-card/55",
        )}
      >
        <div className="flex items-start gap-3">
          <TopicVisual name={topic.name} stableKey={topic.slug || topic.id} size="sm" />
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "truncate text-primary",
                featured ? "text-sm font-semibold" : "text-base font-semibold",
              )}
            >
              <span className="mr-1 text-accent">#</span>
              {topic.name}
            </h3>
            {topic.description ? (
              <p
                className={cn(
                  "line-clamp-1 leading-5 text-muted-foreground",
                  featured ? "mt-0.5 text-xs" : "mt-1 text-[13px]",
                )}
              >
                {topic.description}
              </p>
            ) : null}
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {(topic.contentCount ?? 0) > 0 ? `${topic.contentCount} 篇内容` : "暂无内容"}
              {topic.followerCount && topic.followerCount > 0
                ? ` · ${topic.followerCount} 关注`
                : null}
            </p>
          </div>
          <ArrowRight
            className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 opacity-70 transition-[transform,opacity,color] group-hover:translate-x-1 group-hover:text-accent group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}
