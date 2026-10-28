import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ArticleOutlineItem } from "@/lib/article-markdown";
import { cn } from "@/lib/cn";

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
export function ArticleOutline({ items }: { items: ArticleOutlineItem[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <nav
      aria-label="文章目录"
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
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
            <a
              href={`#${item.id}`}
              className="focus-ring block rounded-sm text-meta leading-5 text-muted-foreground transition-colors hover:text-accent-strong"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
