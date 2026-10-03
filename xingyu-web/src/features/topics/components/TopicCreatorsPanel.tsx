import { Link } from "react-router-dom";
import type { TopicCreatorSummary } from "@/api/topics/topics.types";

export function TopicCreatorsPanel({ creators }: { creators: TopicCreatorSummary[] }) {
  if (creators.length === 0) return null;

  return (
    <aside
      aria-labelledby="topic-creators"
      className="rounded-lg border border-border/50 bg-card/70 p-3"
    >
      <h2 id="topic-creators" className="text-base font-semibold text-primary">
        活跃创作者
      </h2>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {creators.slice(0, 8).map((creator) => {
          const name = creator.displayName || creator.username;
          return (
            <li key={creator.username}>
              <Link
                to={`/u/${encodeURIComponent(creator.username)}`}
                className="group focus-ring flex items-center gap-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
                  {name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-primary group-hover:text-accent">
                    {name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {creator.contentCount} 篇内容
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
