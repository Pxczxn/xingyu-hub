import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * PageHeader — an OPTIONAL page-title treatment for UTILITY surfaces.
 *
 * STATUS: optional, not a template. (repositioned 2026-10-03)
 * -----------------------------------------------------------
 * This was originally written as THE level-1 primitive for every utility page,
 * on the argument that sixty pages had each invented their own `<h1>`. The
 * observation was right; the conclusion — that all of them should therefore share
 * one banner component — was not. A page's title treatment should follow what the
 * page is for, and the pages that need something else should build it.
 *
 * So it is offered alongside `<PageHero>` (and alongside simply writing an `<h1>`),
 * not in place of them. Existing usages are left alone; pages are migrated only
 * when they are refactored for other reasons.
 *
 * The two treatments it deliberately distinguishes:
 *
 *   <PageHero>   portal / plaza / reading pages. Larger title, description,
 *                optional artwork and call to action. It SELLS the page.
 *   <PageHeader> utility pages — settings, 个人中心, 创作台, forms. 24px title,
 *                one line of context, a hairline rule, optional actions. It
 *                LABELS the page and gets out of the way.
 *
 * Reach for `PageHeader` when the page's job is exactly "name this surface and
 * get out of the way". A status page, a wizard, a reading view or a dashboard
 * should decide its own title treatment instead.
 *
 * Rules, IF you use it:
 *   - one <h1> per page, always the first heading in the main landmark;
 *   - `actions` holds at most two controls, and the primary one is last;
 *   - the rule under the header is what separates the page's identity from its
 *     content — do not repeat it as a section divider directly below.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  size = "default",
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Short uppercase label above the title. Use sparingly — utility pages rarely need one. */
  eyebrow?: string;
  size?: "default" | "large";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border/70 pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1
          className={cn(
            "font-semibold tracking-tight text-primary",
            size === "large" ? "text-display" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? <p className="lede mt-2 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
