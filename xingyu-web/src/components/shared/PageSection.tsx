import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * PageSection — an OPTIONAL building block for a level-2 section heading.
 *
 * STATUS: optional, not a template. (repositioned 2026-10-03)
 * -----------------------------------------------------------
 * This component was originally introduced as THE section primitive, with the
 * argument that fifteen hand-rolled heading blocks had drifted apart. That
 * argument was about consistency, and consistency is still worth having — but
 * treating it as the required shape for every section is what flattens pages
 * into the same layout, and a page's structure should follow its job, not a
 * component's API.
 *
 * So: it is a tool, not a rule.
 *
 *   USE it    when a page really does have several sibling sections that should
 *             read as the same kind of thing — a settings hub, a list page with
 *             a heading, a count and one action.
 *   DON'T     adopt it as the page layout. A reader with a table of contents, a
 *             feed, a wizard, a dashboard or a status page has a different
 *             information hierarchy, and should build its own structure from the
 *             tokens instead. Reach for this only when the section anatomy below
 *             is genuinely what the content needs.
 *
 * Existing usages are left in place. Pages are migrated only when they are
 * refactored for other reasons — a wholesale replacement would be churn.
 *
 * What it standardises, IF you use it
 * -----------------------------------
 *   <h2>    section-heading token (18px)     — one step under the page title
 *   count   13px tabular, muted               — a fact about the set, not a heading
 *   desc    13px muted, max 2 lines           — optional, explains the section
 *   action  trailing, baseline-aligned        — one control, never a toolbar
 *
 * Sections are siblings; a section never contains another section. Pass a router
 * `<Link>` (not a bare `<a>`) in `action` — a bare anchor is a full document
 * navigation and would drop the SPA and the chat socket.
 */
export function PageSection({
  id,
  title,
  description,
  count,
  action,
  className,
  contentClassName,
  children,
}: {
  /** Anchor id; also wires `aria-labelledby` so the section is announced by name. */
  id: string;
  title: string;
  /** One sentence explaining what the section holds. Keep it short. */
  description?: string;
  /** Size of the set. Rendered as a muted fact next to the heading, never inside it. */
  count?: number;
  /** A single trailing control (usually a router <Link>), baseline-aligned. */
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0", className)}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h2 id={id} className="section-heading">
              {title}
            </h2>
            {count !== undefined ? (
              <span className="text-meta tabular-nums text-muted-foreground">{count}</span>
            ) : null}
          </div>
          {description ? <p className="lede mt-1.5 max-w-2xl">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

/** Shared look for a section's trailing control. Wrap a router `<Link>` in it. */
export const sectionActionClassName =
  "focus-ring rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong";
