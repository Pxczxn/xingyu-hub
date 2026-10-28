import { createContext, useContext, type ReactNode } from "react";
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

/*
 * Batch 12 — the editor's inline preview renders this same pipeline, and it
 * sits inside the router, so a same-tab `<Link>` there would navigate the
 * author out of `/studio/content/:articleId` mid-draft. The leave-guard would
 * then ask "要离开吗？", which is a worse outcome than the mistake it guards
 * against: previewing your own formatting is not an intent to navigate.
 *
 * So the pipeline takes a mode. `disabled` keeps the anchor and its href — the
 * link still looks like a link, and right-click → copy address still works, so
 * the preview stays a faithful rendering of what will publish — but cancels the
 * click. A preview is for judging typesetting, not for browsing.
 *
 * The default is `false`, so the article page, the discover panel and the
 * series reader keep real navigation; only the editor preview opts in.
 */

type ArticleMarkdownLinkContextValue = {
  /** 编辑器预览：链接保留 href 与样式，但点击不导航。 */
  linksDisabled: boolean;
};

const ArticleMarkdownLinkContext = createContext<ArticleMarkdownLinkContextValue>({
  linksDisabled: false,
});

export function ArticleMarkdownLinkProvider({
  linksDisabled,
  children,
}: {
  linksDisabled: boolean;
  children: ReactNode;
}) {
  return (
    <ArticleMarkdownLinkContext.Provider value={{ linksDisabled }}>
      {children}
    </ArticleMarkdownLinkContext.Provider>
  );
}

function opensInNewTab(href: string): boolean {
  return /^https?:/i.test(href) || href.startsWith("//");
}

/**
 * The dead-link styles belong on the anchor itself, not in a CSS descendant
 * rule, so that `disabled` never depends on where the preview happens to mount.
 */
const DISABLED_CLASS = "cursor-default";

export function ArticleMarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const inRouter = useInRouterContext();
  const { linksDisabled } = useContext(ArticleMarkdownLinkContext);
  const target = href ?? "";

  if (!target) {
    /*
     * `[text]()` — a Markdown link with no destination. It is not a link, so it
     * must not be an `<a>`: an anchor without `href` is not focusable and
     * asserts a navigation that cannot happen (jsx-a11y/anchor-is-valid).
     */
    return <>{children}</>;
  }

  const stopNavigation = (event: { preventDefault: () => void }) => event.preventDefault();

  /* Somebody else's site: leaving the community IS a new context. */
  if (opensInNewTab(target)) {
    return (
      <a
        href={target}
        target="_blank"
        rel="noreferrer noopener"
        className={linksDisabled ? DISABLED_CLASS : undefined}
        onClick={linksDisabled ? stopNavigation : undefined}
      >
        {children}
      </a>
    );
  }

  /* In-page anchor (`#`), `mailto:`/`tel:`, or a relative path we cannot route. */
  if (!target.startsWith("/")) {
    return (
      <a
        href={target}
        className={linksDisabled ? DISABLED_CLASS : undefined}
        onClick={linksDisabled ? stopNavigation : undefined}
      >
        {children}
      </a>
    );
  }

  /* Site link: same-tab navigation. Degrades to <a> where there is no router. */
  if (!inRouter || linksDisabled) {
    return (
      <a
        href={target}
        className={linksDisabled ? DISABLED_CLASS : undefined}
        onClick={linksDisabled ? stopNavigation : undefined}
      >
        {children}
      </a>
    );
  }
  return <Link to={target}>{children}</Link>;
}
