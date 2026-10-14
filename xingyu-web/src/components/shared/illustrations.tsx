/*
 * Illustrations, in the language this product already speaks.
 *
 * 星语's own artwork is abstract and geometric: the `Orbit` badge that `PageHero`
 * falls back to, and the constellation plate on /galaxies (thin gold strokes and
 * dots on a muted plate). There is no figurative illustration anywhere in the app.
 *
 * 2026-10-03 — I first went looking for stock artwork (unDraw), as asked. Their
 * catalogue is reachable but only the first 40 entries are server-rendered, and
 * every one of them is a human figure in an office scene. Recolouring those to
 * Navy/Cream/Gold fixes the hue and not the register — and the skin tones have no
 * home in a three-colour palette, so a recoloured figure reads as a mistake. The
 * brief's own first priority is to reuse the existing visual language, so these are
 * drawn in it instead. Swapping in stock art later is a one-file change: everything
 * below is a plain component that takes a className.
 *
 * COLOUR: every token in tokens.css is an HSL TRIPLET (`--border: 40 14% 87%`), not
 * a colour. `stroke="var(--border)"` is therefore invalid and silently paints
 * nothing — which is exactly what the first version of this file did, leaving three
 * black dots where a drawing should have been. Always wrap: `hsl(var(--border))`.
 *
 * Rules these follow:
 *   - Gold strokes resolve through --accent-strong. Raw brand gold measures 2.01:1
 *     on cream (see tokens.css) and a hairline in it is invisible; --accent is the
 *     FILL, and is only used where a solid shape can carry it.
 *   - `aria-hidden`: every one duplicates meaning already carried by the heading and
 *     copy beside it. Announcing them again is noise.
 *   - Flat. No filters, no gradients — the same rule the rest of the surfaces follow.
 *
 * 2026-10-13 — slots:
 *   The drawings below are placeholders. `IllustrationSlot` renders one into the
 *   box its slot declares in `illustration-slots.ts`, and renders a supplied image
 *   instead once that slot's `src` is set. Call sites go through the wrapper so the
 *   artwork swap stays a data change (one field) rather than a component rewrite.
 *   The SVG keeps `h-full w-full` so the slot's box is what decides the size.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ILLUSTRATION_SLOTS, illustrationBox, type IllustrationSlotId } from "./illustration-slots";

type IllustrationProps = { className?: string };

/**
 * Renders the artwork for a slot: the supplied image if one is configured, the
 * built-in drawing otherwise.
 *
 * The wrapper owns the box (fixed width × height from `illustration-slots.ts`) and
 * is `aria-hidden` as a whole — every drawing here duplicates meaning already
 * carried by the heading and copy beside it, so the image is decorative by
 * definition and `alt` stays empty.
 */
export function IllustrationSlot({
  id,
  fallback,
  className,
}: {
  id: IllustrationSlotId;
  /** Built-in drawing used until the slot has a `src`. */
  fallback: ReactNode;
  className?: string;
}) {
  const slot = ILLUSTRATION_SLOTS[id];
  return (
    <div
      aria-hidden
      style={illustrationBox(id)}
      className={cn("flex shrink-0 items-center justify-center", className)}
    >
      {slot.src ? <img src={slot.src} alt="" className="h-full w-full object-contain" /> : fallback}
    </div>
  );
}

/*
 * A star that has slipped its orbit.
 *
 * Job: the 404 page — a dead end with nothing to look at. This gives it a focal
 * point and says "off the map" in the same breath. The break in the path is the
 * whole idea, so the drawing is not decoration on top of one.
 */
export function LostOrbit({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" className={className} aria-hidden focusable="false">
      {/* the orbit, with a gap on the upper right where the body left it */}
      <path
        d="M136 26a48 48 0 1 0 12 34"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* the fading remainder of that arc */}
      <path
        d="M158 46a48 48 0 0 1 2 34"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="2 7"
      />
      {/* still in orbit */}
      <circle
        cx="100"
        cy="18"
        r="5"
        fill="hsl(var(--card))"
        stroke="hsl(var(--accent-strong))"
        strokeWidth="1.75"
      />
      <circle
        cx="52"
        cy="66"
        r="4"
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="1.75"
      />
      {/* the one that got away — the only solid gold in the drawing */}
      <circle cx="166" cy="34" r="7.5" fill="hsl(var(--accent))" />
      <path
        d="M166 12v-8M186 34h9M152 20l-6-6"
        stroke="hsl(var(--accent-strong))"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/*
 * A ring waiting to be filled.
 *
 * Job: the empty states. Deliberately NOT the same drawing as the 404 — that one is
 * about being off the map; this one is about a container that is still empty, so the
 * composition is a closed ring with a centred mark and nothing escaping. It reads as
 * "yours, currently empty" rather than "something went wrong".
 */
export function EmptyRing({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" className={className} aria-hidden focusable="false">
      <ellipse
        cx="100"
        cy="66"
        rx="66"
        ry="42"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.75"
      />
      <ellipse cx="100" cy="66" rx="42" ry="26" fill="hsl(var(--accent-soft))" />
      <ellipse
        cx="100"
        cy="66"
        rx="42"
        ry="26"
        fill="none"
        stroke="hsl(var(--accent-strong))"
        strokeWidth="1.75"
        strokeDasharray="5 8"
        strokeLinecap="round"
      />
      {/* three ticks on the outer ring — it is a frame, not a face */}
      <path
        d="M100 24v-8M34 66h-8M166 66h8"
        stroke="hsl(var(--border))"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="100" cy="66" r="4.5" fill="hsl(var(--accent))" />
    </svg>
  );
}
