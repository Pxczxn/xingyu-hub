import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import type { ArticleOutlineItem } from "@/lib/article-markdown";
import { cn } from "@/lib/cn";
import {
  activeHeadingId,
  readingMarkerOffset,
  scrollOutlineItemIntoView,
} from "@/features/article/article-outline-active";

/*
 * The article's table of contents.
 *
 * Batch 11 extracted it from `ArticleDetailPage` for three fixes that all live
 * in this one block of markup:
 *
 * 1. LONG OUTLINES COULD NOT BE READ. The sticky rail had `lg:sticky lg:top-24`
 *    and nothing else, so an outline with 28 headings rendered 1064.5px tall
 *    inside a 900px viewport with `overflow-y: visible`. The last item sat at
 *    top 1123.5px no matter where the page was scrolled — it could never be
 *    reached. The series reader's chapter rail had already solved this with
 *    `lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto`; the same pair is applied
 *    here (plus `overscroll-contain`, so scrolling the outline does not scroll
 *    the article underneath once it hits the end).
 *
 * 2. IT BLOCKED THE BODY ON NARROW SCREENS. Below `lg` the outline is `order-1`
 *    — above the body — because a rail needs width the phone does not have. That
 *    is right, but it was expanded: on 768px with 28 headings the reader had to
 *    scroll 784px of outline before reaching line one of the article. It now
 *    collapses to a single row (`目录 · 3 节`) and expands on demand. `<button>`
 *    + `aria-expanded`, not `<details>`: `<details>` cannot be forced open at
 *    `lg` without JavaScript, and a duplicate open state is a bug waiting.
 *
 * 3. ANCHOR JUMPS LANDED UNDER THE STICKY HEADER. Fixed in CSS, not here —
 *    `xingyu-web/src/styles/globals.css` gives `.article-body h2/h3/h4`
 *    `scroll-margin-top`. It belongs there rather than on the anchors because
 *    the target is the heading, and any other in-page link to a heading (a
 *    footnote backref, a shared deep link) gets the same compensation.
 */
function useTrackedHeading(ids: readonly string[], navRef: RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  /*
   * A click whose heading cannot reach the reading line (the page ends first)
   * would otherwise be overwritten by the end-of-page rule. Hold that choice
   * until the jump settles, then release it once the reader scrolls away.
   */
  const pin = useRef<{ id: string; origin: number; anchor: number | null } | null>(null);
  const key = ids.join("\0");

  useEffect(() => {
    const idList = key.length > 0 ? key.split("\0") : [];
    const measure = () => {
      const probes = idList.flatMap((id) => {
        const element = document.getElementById(id);
        if (!element) return [];
        return [{ id, top: element.getBoundingClientRect().top + window.scrollY }];
      });
      const viewport = {
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        markerOffset: readingMarkerOffset(),
      };
      const next = activeHeadingId(probes, viewport);
      const held = pin.current;
      if (held && idList.includes(held.id)) {
        const heading = probes.find((probe) => probe.id === held.id);
        const line = viewport.scrollY + viewport.markerOffset;
        const arrived =
          next === held.id || (heading != null && Math.abs(heading.top - line) <= 24);
        const left =
          held.anchor != null && Math.abs(viewport.scrollY - held.anchor) > 48;
        if (!arrived && !left) {
          setActiveId(held.id);
          return;
        }
        pin.current = null;
      }
      setActiveId(next);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [key]);

  useEffect(() => {
    if (!activeId) return;
    const link = navRef.current?.querySelector<HTMLElement>(
      `a[href="#${CSS.escape(activeId)}"]`,
    );
    if (link) scrollOutlineItemIntoView(link);
  }, [activeId, navRef]);

  return [
    activeId,
    (id: string) => {
      pin.current = { id, origin: window.scrollY, anchor: null };
      setActiveId(id);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (pin.current?.id === id && pin.current.anchor == null) {
            pin.current.anchor = window.scrollY;
          }
        });
      });
    },
  ] as const;
}

function OutlineEntries({
  items,
  navRef,
  onItemSelect,
}: {
  items: ArticleOutlineItem[];
  navRef: RefObject<HTMLElement | null>;
  onItemSelect?: (id: string) => void;
}) {
  const ids = items.map((item) => item.id).filter((id) => id.length > 0);
  const [activeId, choose] = useTrackedHeading(ids, navRef);

  return (
    <>
      {items.map((item) => {
        const current = item.id.length > 0 && activeId === item.id;
        return (
          <li key={item.id} className="relative" style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
            <a
              href={`#${item.id}`}
              aria-current={current ? "location" : undefined}
              onClick={() => {
                if (item.id.length > 0) {
                  choose(item.id);
                  onItemSelect?.(item.id);
                }
              }}
              className={cn(
                "focus-ring block rounded-sm text-meta leading-5 transition-colors",
                current
                  ? "relative bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-accent-strong",
              )}
            >
              {current ? (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
                />
              ) : null}
              {item.text}
            </a>
          </li>
        );
      })}
    </>
  );
}

export function ArticleOutline({
  items,
  label = "文章目录",
  rail = false,
  hideEyebrow = false,
  onItemSelect,
}: {
  items: ArticleOutlineItem[];
  /** Accessible name. Articles keep the default; other readers pass their own. */
  label?: string;
  /**
   * `rail` = the outline is rendered INSIDE a `ReaderFrame` side track
   * (`C-reader.md` §2: 工具 → 进度 → 目录). In that context the frame's
   * `<aside>` already owns stickiness and the bounded scroll, and the outline
   * never appears below 1440 — so the disclosure row and the second sticky
   * container would be dead weight inside it. The standalone variant is kept
   * for callers that still render the outline in the document flow.
   */
  rail?: boolean;
  /** Sheet chrome already titles the list; the rail eyebrow would repeat it. */
  hideEyebrow?: boolean;
  /** Fired after the existing pin/jump path, e.g. to close a compact sheet. */
  onItemSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const navRef = useRef<HTMLElement>(null);

  if (rail) {
    return (
      <nav ref={navRef} aria-label={label} className="min-w-0">
        {hideEyebrow ? null : <p className="eyebrow mb-3">目录</p>}
        <ul className="flex list-none flex-col gap-2 p-0">
          <OutlineEntries items={items} navRef={navRef} onItemSelect={onItemSelect} />
        </ul>
      </nav>
    );
  }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn(
        "order-1 rounded-xl border border-border/70 bg-card px-4 py-3",
        "lg:order-2 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-4 lg:py-4",
      )}
    >
      {/*
        Narrow screens get the disclosure row; at `lg` the outline is a rail and
        the row is redundant (the eyebrow below says the same thing), so it is
        hidden. `aria-expanded` on a button that disappears at desktop is fine —
        the list it controls is unconditionally visible there.
      */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-sm text-left lg:hidden"
      >
        <span className="eyebrow">目录</span>
        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
          {items.length} 节
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>

      <p className="eyebrow mb-3 hidden lg:block">目录</p>

      <ul
        id={listId}
        className={cn(
          "flex list-none flex-col gap-1.5 p-0",
          open ? "mt-3 flex" : "hidden lg:mt-0 lg:flex",
        )}
      >
        <OutlineEntries items={items} navRef={navRef} onItemSelect={onItemSelect} />
      </ul>
    </nav>
  );
}
