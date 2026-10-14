/*
 * Staggered list entrance.
 *
 * A list that fades in as one block reads as a page load; the same list arriving
 * item by item reads as content filling in. The second is what we want on a grid
 * of cards, so each item gets `animate-rise-in` plus a delay derived from its
 * position.
 *
 * Two limits, both deliberate:
 *
 *   - The delay is CAPPED. Past roughly the eighth item the wait stops reading as
 *     rhythm and starts reading as lag — an item the reader is already looking at
 *     should not still be fading in. Everything from index 8 on shares one delay.
 *   - It is applied to the first screen only. This is a mount animation, not a
 *     scroll trigger: items below the fold animate while nobody is watching, which
 *     is free. An IntersectionObserver would need JS on every scroll and would
 *     fight the test environment for no visible gain.
 *
 * The delay is returned as a string for `style={{ animationDelay }}` rather than
 * living in a CSS class: Tailwind's `animate-*` shorthand resets `animation-delay`
 * whenever both land on the same element, so a class cannot win there.
 */

/** Delay added per item, in ms. */
export const STAGGER_STEP_MS = 40;

/** Last index that still gets its own delay; later items share this one. */
export const STAGGER_MAX_INDEX = 8;

export function staggerDelay(index: number): string {
  const clamped = Math.min(Math.max(index, 0), STAGGER_MAX_INDEX);
  return `${clamped * STAGGER_STEP_MS}ms`;
}
