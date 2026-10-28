import type { ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";

/*
 * In-article links — the `a` component of the Markdown reading pipeline.
 *
 * Batch 11: this used to be `<a target="_blank" rel="noreferrer">` for EVERY
 * link, including the site's own (`/topics/tech`, `/u/someone`,
 * `/articles/<id>`). An author linking another article in the same community is
 * continuing the reading session, not opening a new application: forcing a new
 * tab leaves the reader with two tabs of the same site, breaks the back button,
 * and on iOS Safari drops them in a bare tab with no way back.
 *
 * The rule now is the one browsers and docs platforms settled on — a SITE link
 * is a router navigation in the same tab:
 *
 *   https://… / http://… / //host/…   → new tab (`noreferrer noopener`)
 *   /topics/tech, /u/…, /articles/…   → `<Link>`, same tab
 *   #anchor, mailto:, tel:, relative  → plain `<a>`, current tab, untouched
 *
 * `useInRouterContext` rather than a bare `<Link>` because this renderer is
 * also mounted outside the router: `xingyu-web/src/lib/article-renderer-roundtrip.test.tsx`
 * renders the body directly, and the editor's preview could be embedded
 * anywhere. Outside a router a site link degrades to a plain same-tab `<a>`
 * instead of throwing.
 */

function opensInNewTab(href: string): boolean {
  return /^https?:/i.test(href) || href.startsWith("//");
}

export function ArticleMarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const inRouter = useInRouterContext();
  const target = href ?? "";

  if (!target) {
    /*
     * `[text]()` — a Markdown link with no destination. It is not a link, so it
     * must not be an `<a>`: an anchor without `href` is not focusable and
     * asserts a navigation that cannot happen (jsx-a11y/anchor-is-valid).
     */
    return <>{children}</>;
  }

  /* Somebody else's site: leaving the community IS a new context. */
  if (opensInNewTab(target)) {
    return (
      <a href={target} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  /* In-page anchor (`#`), `mailto:`/`tel:`, or a relative path we cannot route. */
  if (!target.startsWith("/")) {
    return <a href={target}>{children}</a>;
  }

  /* Site link: same-tab navigation. Degrades to <a> where there is no router. */
  if (!inRouter) {
    return <a href={target}>{children}</a>;
  }
  return <Link to={target}>{children}</Link>;
}
