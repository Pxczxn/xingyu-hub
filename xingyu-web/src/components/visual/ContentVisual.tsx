import {
  AlignLeft,
  BookOpen,
  Compass,
  FileText,
  LibraryBig,
  MessageCircle,
  Shapes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const TYPE_ICONS: Record<string, LucideIcon[]> = {
  ARTICLE: [FileText, AlignLeft],
  SERIES: [BookOpen, LibraryBig],
  MOMENT: [MessageCircle],
};

const FALLBACK_ICONS: LucideIcon[] = [Compass, Shapes, AlignLeft];
const COMPOSITIONS = [
  "bg-card border-border/70",
  "bg-surface-sunken/70 border-border/60",
  "bg-accent-soft border-accent-line/60",
  "bg-primary/[0.035] border-primary/12",
  "bg-card border-accent-line/50",
];

export type ContentVisualVariant = "compact" | "card" | "feature";

export function contentVisualIconName(objectType?: string, stableKey = ""): string {
  const normalizedType = (objectType ?? "").toUpperCase();
  const iconOptions = TYPE_ICONS[normalizedType];
  if (iconOptions === TYPE_ICONS.ARTICLE)
    return ["FileText", "AlignLeft"][stableVariant(`${stableKey}:icon`, 2)];
  if (iconOptions === TYPE_ICONS.SERIES)
    return ["BookOpen", "LibraryBig"][stableVariant(`${stableKey}:icon`, 2)];
  if (iconOptions === TYPE_ICONS.MOMENT) return "MessageCircle";
  return ["Compass", "Shapes", "AlignLeft"][stableVariant(`${stableKey}:icon`, 3)];
}

/*
 * Decorative plate for content that has no real cover image.
 *
 * 2026-10-03 (layout pass): a coverless card used to be a 2.15:1 grey box with a
 * 28px glyph floating in the middle — roughly 60% of the card's height carrying no
 * information, which is what made the discover grid read as "a lot of empty
 * rectangles". Two changes:
 *
 *   - the plate is shorter (2.6:1), so the text block gets the space back;
 *   - `label` renders the content type inside the plate, bottom-left. The plate
 *     now states what the item IS instead of being pure texture, and the caller
 *     can drop its separate type chip.
 *
 * The plate stays `aria-hidden`: it duplicates information that is already in the
 * accessible name of the card link, so announcing it again would be noise.
 */
export function ContentVisual({
  stableKey,
  objectType,
  cover,
  variant = "card",
  label,
  className,
}: {
  stableKey: string;
  objectType?: string;
  cover?: string;
  variant?: ContentVisualVariant;
  /** Optional caption rendered inside the plate (e.g. 文章 / 系列 / 动态). */
  label?: string;
  className?: string;
}) {
  if (cover) {
    return (
      <img
        src={cover}
        alt=""
        data-content-visual-variant={variant}
        className={cn(
          "block w-full rounded-lg object-cover",
          variant === "card" ? "aspect-[2.6/1]" : "aspect-video",
          className,
        )}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const normalizedType = (objectType ?? "").toUpperCase();
  const iconOptions = TYPE_ICONS[normalizedType] ?? FALLBACK_ICONS;
  const Icon = iconOptions[stableVariant(`${stableKey}:icon`, iconOptions.length)];
  const iconName = contentVisualIconName(objectType, stableKey);
  const composition = stableVariant(`${stableKey}:composition`, COMPOSITIONS.length);
  const iconSize = variant === "feature" ? "h-8 w-8" : variant === "card" ? "h-6 w-6" : "h-5 w-5";

  return (
    <span
      aria-hidden
      data-testid="content-visual"
      data-content-visual-key={stableKey}
      data-content-visual-type={normalizedType || "UNKNOWN"}
      data-content-visual-icon={iconName}
      data-content-visual-variant={variant}
      data-content-visual-composition={composition}
      className={cn(
        "relative block w-full overflow-hidden rounded-lg border",
        variant === "card" ? "aspect-[2.6/1]" : "aspect-video",
        COMPOSITIONS[composition],
        className,
      )}
    >
      {composition === 0 ? (
        <>
          <span className="absolute -right-4 -top-6 h-16 w-16 rounded-full border border-accent-line/70" />
          <span className="absolute bottom-4 left-4 h-px w-1/4 bg-primary/15" />
          <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" />
        </>
      ) : composition === 1 ? (
        <>
          <span className="absolute left-4 top-4 h-px w-2/5 bg-primary/15" />
          <span className="absolute left-4 top-7 h-px w-1/4 bg-primary/10" />
          <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" />
        </>
      ) : composition === 2 ? (
        <>
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-accent-line/70" />
          <span className="absolute -right-2 -top-2 h-14 w-14 rounded-full border border-accent-line/50" />
          <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" />
        </>
      ) : composition === 3 ? (
        <>
          <span className="absolute inset-x-4 top-4 h-px bg-primary/12" />
          <span className="absolute inset-x-4 bottom-4 h-px bg-primary/12" />
          <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-accent" />
        </>
      ) : (
        <>
          <span className="absolute bottom-4 left-4 h-7 w-7 rounded-bl-md border-b border-l border-accent-line" />
          <span className="absolute right-4 top-4 h-7 w-7 rounded-tr-md border-r border-t border-primary/15" />
          <span className="absolute bottom-4 right-4 h-1.5 w-1.5 rounded-full bg-accent" />
        </>
      )}

      {/* Glyph sits left-of-centre so the caption below has room and the plate
          stops looking like a placeholder waiting for an image. */}
      <span className="absolute inset-y-0 left-4 flex items-center text-primary/55">
        <Icon className={iconSize} strokeWidth={variant === "compact" ? 1.5 : 1.4} />
      </span>

      {label ? (
        <span className="absolute bottom-3 right-4 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-strong/90">
          {label}
        </span>
      ) : null}
    </span>
  );
}
