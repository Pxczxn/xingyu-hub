import { SeriesCover } from "@/components/visual/SeriesCover";

export function GeneratedSeriesCover({ seriesKey, title }: { seriesKey: string; title: string }) {
  return <SeriesCover stableKey={seriesKey} title={title} />;
}
