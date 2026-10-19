/** One-pixel tolerance for sub-pixel layout rounding. */
export function hasHorizontalOverflow(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth > clientWidth + 1;
}
