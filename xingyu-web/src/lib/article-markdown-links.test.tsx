import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ArticleMarkdownBody } from "@/lib/article-markdown";

/*
 * In-article link behaviour (batch 11).
 *
 * The reading pipeline used to emit `<a target="_blank" rel="noreferrer">` for
 * EVERY anchor, so an author linking `/topics/tech` or another article in the
 * same community forced a second tab of the same site. The rule now: site links
 * navigate in the same tab, external web addresses keep the new tab, and
 * everything else (`#anchor`, `mailto:`, relative) is left to the browser.
 *
 * These tests drive the real `ArticleMarkdownBody` — not the link component in
 * isolation — because the decision is made inside the remark/rehype component
 * map and only the rendered DOM proves the pipeline picked it up.
 */

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderBody(markdown: string, { router = true } = {}) {
  const body = <ArticleMarkdownBody body={markdown} />;
  if (!router) return render(body);
  return render(
    <MemoryRouter>
      <LocationProbe />
      {body}
    </MemoryRouter>,
  );
}

function anchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>(".article-body a"));
}

describe("article markdown links", () => {
  it("navigates site links in the same tab", () => {
    const { container } = renderBody("[话题](/topics/tech) 与 [作者](/u/series_probe)");

    const [topic, author] = anchors(container);
    expect(topic.getAttribute("href")).toBe("/topics/tech");
    expect(author.getAttribute("href")).toBe("/u/series_probe");
    /* The whole point of the fix: no new tab for our own pages. */
    expect(topic).not.toHaveAttribute("target");
    expect(author).not.toHaveAttribute("target");
  });

  it("keeps external web addresses in a new tab", () => {
    const { container } = renderBody("[外部](https://example.com/doc)");

    const [external] = anchors(container);
    expect(external.getAttribute("href")).toBe("https://example.com/doc");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external.getAttribute("rel")).toContain("noreferrer");
    expect(external.getAttribute("rel")).toContain("noopener");
  });

  it("treats protocol-relative addresses as external", () => {
    const { container } = renderBody("[外部](//cdn.example.com/a.png)");

    expect(anchors(container)[0]).toHaveAttribute("target", "_blank");
  });

  it("leaves in-page anchors and mailto links to the browser", () => {
    const { container } = renderBody("[跳转](#article-h-1) 与 [写信](mailto:hi@example.com)");

    const [anchor, mail] = anchors(container);
    expect(anchor.getAttribute("href")).toBe("#article-h-1");
    expect(mail.getAttribute("href")).toBe("mailto:hi@example.com");
    expect(anchor).not.toHaveAttribute("target");
    expect(mail).not.toHaveAttribute("target");
  });

  /*
   * The renderer is also mounted outside the router (the editor's markdown
   * preview, and `article-renderer-roundtrip.test.tsx`). A `<Link>` there would
   * throw; the component must degrade to a plain same-tab `<a>`.
   */
  it("renders site links as plain anchors when there is no router", () => {
    const { container } = renderBody("[话题](/topics/tech)", { router: false });

    const [topic] = anchors(container);
    expect(topic.getAttribute("href")).toBe("/topics/tech");
    expect(topic).not.toHaveAttribute("target");
  });

  it("keeps external links external even without a router", () => {
    const { container } = renderBody("[外部](https://example.com)", { router: false });

    expect(anchors(container)[0]).toHaveAttribute("target", "_blank");
  });
});
