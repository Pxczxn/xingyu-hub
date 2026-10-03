import { PageHero } from "@/components/shared/PageHero";

export function DiscoverHero() {
  return (
    <PageHero
      compact
      eyebrow="EXPLORE"
      title="发现"
      description="从话题与内容出发，探索社区里正在发生的事。"
      tone="gold"
      className="py-3 sm:py-3"
    />
  );
}
