import type { TopicSummary } from "@/api/topics/topics.types";
import { TopicVisual } from "@/components/visual/TopicVisual";

export function TopicHeader({ topic }: { topic: TopicSummary }) {
  const meta = [
    topic.contentCount !== undefined ? `${topic.contentCount} 内容` : null,
    topic.followerCount && topic.followerCount > 0 ? `${topic.followerCount} 关注` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    /*
      Sticky from `lg` up.
      A topic page is a long content list, and the topic's own name and counts
      are the context for every row in it. Scrolling them away means the reader
      loses the answer to "what am I looking at" while still reading it. The
      surface is opaque (not `bg-card/60`) because a translucent sticky header
      shows the rows sliding underneath it.
    */
    <header className="rounded-lg border border-border/70 bg-card px-4 py-3.5 lg:sticky lg:top-24 lg:z-20">
      <div className="flex items-start gap-3">
        <TopicVisual name={topic.name} stableKey={topic.slug || topic.id} size="md" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {/*
              `accent-strong`, not `accent`. The raw brand gold measures 2.01:1 on
              a light surface — the `#` was effectively invisible, which is the
              same defect the token pass fixed for every other gold label.
            */}
            <span aria-hidden className="mr-1 text-accent-strong">
              #
            </span>
            {topic.name}
          </h1>
          {topic.description ? (
            <p className="mt-1 max-w-3xl text-meta leading-6 text-muted-foreground">
              {topic.description}
            </p>
          ) : null}
          {/*
            The counts are this topic's substance — how much is in it, how many
            people follow it — so they sit at the meta step rather than at 12px
            grey, which is where a decorative footnote belongs.
          */}
          {meta ? <p className="mt-2 text-meta text-foreground-soft">{meta}</p> : null}
        </div>
      </div>
    </header>
  );
}
