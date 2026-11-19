/*
 * Which outline row is the one being read.
 *
 * The reading line sits one header-clearance below the viewport top — the same
 * clearance `.article-body h2/h3/h4` use as `scroll-margin-top`. The current
 * heading is the last one whose top is on or above that line. An H3 therefore
 * replaces its H2 as soon as the line reaches it, and stays current until the
 * next heading crosses the line. Several headings can sit inside the viewport
 * at once; the line, not the last observer callback, decides among them.
 *
 * A page that cannot scroll is still at the top, so the end rule does not
 * apply. Once the reader actually reaches the bottom, the last heading wins
 * even when there is not enough room left to bring it up to the line.
 */

export type OutlineHeadingPosition = {
  id: string;
  /** Document Y of the heading's top border. */
  top: number;
};

export type OutlineViewport = {
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
  /** Pixels from the viewport top to the reading line. */
  markerOffset: number;
};

export function readingMarkerOffset(root: HTMLElement = document.documentElement): number {
  const styles = getComputedStyle(root);
  const fontSize = parseFloat(styles.fontSize);
  const rem = Number.isFinite(fontSize) ? fontSize : 16;
  const headerRaw = styles.getPropertyValue("--shell-header-height").trim();
  let header = Number.NaN;
  if (headerRaw.endsWith("rem")) header = parseFloat(headerRaw) * rem;
  else if (headerRaw.endsWith("px") || headerRaw !== "") header = parseFloat(headerRaw);
  return (Number.isFinite(header) ? header : 64) + rem;
}

export function activeHeadingId(
  headings: readonly OutlineHeadingPosition[],
  viewport: OutlineViewport,
): string | null {
  if (headings.length === 0) return null;
  const ordered = [...headings].sort((left, right) => left.top - right.top);
  const maxScroll = viewport.scrollHeight - viewport.viewportHeight;
  if (maxScroll > 1 && viewport.scrollY >= maxScroll - 1) {
    return ordered[ordered.length - 1]?.id ?? null;
  }
  const line = viewport.scrollY + viewport.markerOffset;
  let current: string | null = null;
  for (const heading of ordered) {
    if (heading.top <= line + 0.5) current = heading.id;
    else break;
  }
  return current;
}

function isScrollable(element: HTMLElement): boolean {
  if (element === document.body || element === document.documentElement) return false;
  const overflow = getComputedStyle(element).overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return element.scrollHeight > element.clientHeight + 1;
}

/**
 * Bring a clipped outline row into its own scroller. Never calls
 * `scrollIntoView`: that also scrolls the reading page, and the rail is
 * already a nested overflow box.
 */
export function scrollOutlineItemIntoView(item: HTMLElement): void {
  let parent = item.parentElement;
  while (parent) {
    if (isScrollable(parent)) break;
    parent = parent.parentElement;
  }
  if (!parent) return;
  const box = parent.getBoundingClientRect();
  const row = item.getBoundingClientRect();
  if (row.top < box.top) parent.scrollTop -= box.top - row.top;
  else if (row.bottom > box.bottom) parent.scrollTop += row.bottom - box.bottom;
}
