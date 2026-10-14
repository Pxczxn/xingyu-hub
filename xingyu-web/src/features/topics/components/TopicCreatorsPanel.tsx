import { Link } from "react-router-dom";
import type { TopicCreatorSummary } from "@/api/topics/topics.types";

/*
 * Active creators — the topic page's P2 block (设计方案 §3.3: 创作者排在话题身份块之后). It sits in the right rail and is therefore the one block allowed to be
 * secondary.
 *
 * 2026-10-13 (批次 04) — the surface was `bg-card/70` on `p-3`, which read as a
 * faded chip rather than as a section of the page. Now opaque `bg-card` on `p-4`,
 * matching the galaxy members rail: the fill stops being a signal, and the only
 * thing separating this block from the content column is the column itself.
 *
 * It is deliberately NOT `lg:sticky`. The topic identity header above already owns
 * the one sticky slot at `top-24`; a second sticky at the same offset would slide
 * under it. The galaxy rail can stick because its shell's header scrolls away —
 * the topic header does not.
 */
export function TopicCreatorsPanel({ creators }: { creators: TopicCreatorSummary[] }) {
  if (creators.length === 0) return null;

  return (
    <aside
      aria-labelledby="topic-creators"
      className="animate-rise-in rounded-lg border border-border/60 bg-card p-4"
    >
      <h2 id="topic-creators" className="text-base font-semibold tracking-tight text-primary">
        活跃创作者
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5">
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
                  <span className="block truncate text-sm font-medium text-primary group-hover:text-accent-strong">
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
