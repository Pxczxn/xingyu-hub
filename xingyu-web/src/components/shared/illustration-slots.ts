/*
 * Illustration slots — the single source of truth for every place in the app that
 * displays artwork, and the exact box that artwork must fit.
 *
 * Why this file exists (2026-10-13):
 *   The built-in drawings are going to be replaced with supplied images. Before
 *   that swap can happen each slot needs a stated size, otherwise the replacement
 *   arrives at whatever ratio the source file happens to have and either distorts
 *   or pushes the text column around. The box is the contract; the artwork is
 *   content.
 *
 * How to supply an image:
 *   1. Drop the file in `xingyu-web/public/illustrations/` (any raster format), or
 *      use an absolute URL — a placeholder service works too, e.g.
 *      `https://placehold.co/336x224/f9f7f2/1a2138?text=Hero`.
 *   2. Set `src` on the matching slot below. That is the only edit required; every
 *      call site renders through `IllustrationSlot`, which picks up the change.
 *   3. Leave `src` undefined to keep the built-in SVG.
 *
 * Contract for the image itself:
 *   - The artwork is centred in the box and never cropped (`object-contain`), so a
 *     file close to `ratio` fills the box and a wider/taller file letterboxes
 *     instead of clipping. Keep the subject inside the box — the surrounding
 *     layout reserves no room for overhang.
 *   - Export at `export` (2× the box) for retina. Larger is fine; the box scales it.
 *   - Transparent background reads best on the cream surface. A file with its own
 *     opaque background will show its rectangle against the card.
 *
 * Why only three slots: an illustration on every surface stops reading as a signal
 * and starts reading as noise. These three are the states where the reader has
 * nothing else to look at — a dead end, an empty container, and the banner of an
 * entry page. Section-level states (`SectionState`) and error pages deliberately
 * have none; they sit next to real content and a drawing there is clutter.
 */

export type IllustrationSlotId = "hero" | "notFound" | "empty";

export type IllustrationSlot = {
  /** CSS box the artwork is drawn into, in px. */
  width: number;
  height: number;
  /** Recommended aspect ratio for the source file. */
  ratio: string;
  /** Recommended raster export size, 2× the box, for retina displays. */
  export: string;
  /** Where this slot appears, so a supplier knows the context. */
  where: string;
  /**
   * Replacement artwork: a path under `public/` (e.g. `/illustrations/hero.png`)
   * or an absolute URL. Undefined keeps the built-in SVG placeholder.
   */
  src?: string;
};

export const ILLUSTRATION_SLOTS: Record<IllustrationSlotId, IllustrationSlot> = {
  hero: {
    width: 168,
    height: 112,
    ratio: "3:2",
    export: "336 × 224",
    where: "PageHero 右侧插图（入口型页面横幅，≥1024px 显示）",
  },
  notFound: {
    width: 192,
    height: 128,
    ratio: "3:2",
    export: "384 × 256",
    where: "404 页，居中于卡片上方",
  },
  empty: {
    width: 120,
    height: 80,
    ratio: "3:2",
    export: "240 × 160",
    where: "PageState 空态（整页或区块内）",
  },
};

/** The CSS box for a slot, ready to spread onto a wrapper. */
export function illustrationBox(id: IllustrationSlotId): {
  width: string;
  height: string;
} {
  const slot = ILLUSTRATION_SLOTS[id];
  return { width: `${slot.width}px`, height: `${slot.height}px` };
}
