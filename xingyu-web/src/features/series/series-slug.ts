import { pinyin } from "pinyin-pro";

export const SERIES_SLUG_PATTERN = /^[a-z0-9-]{2,64}$/;

export function isValidSeriesSlug(value: string): boolean {
  return SERIES_SLUG_PATTERN.test(value);
}

export function suggestSeriesSlug(raw: string): string {
  const source = raw.trim();
  if (!source) return "";
  const pieces = pinyin(source, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: true,
  }) as string[];
  return pieces
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
