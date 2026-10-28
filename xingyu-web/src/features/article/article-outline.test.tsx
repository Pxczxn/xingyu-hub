import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleOutline } from "@/features/article/components/ArticleOutline";
import type { ArticleOutlineItem } from "@/lib/article-markdown";

/*
 * Article outline (table of contents).
 *
 * Batch 11 turned this into its own component for three measured problems, and
 * these tests pin the two that are expressible in jsdom:
 *
 *   - a long outline must stay reachable (the rail scrolls instead of growing
 *     past the viewport),
 *   - on narrow screens it must not push the body down before the reader has
 *     asked for it.
 *
 * The third fix — anchor jumps landing under the sticky header — is CSS
 * (`scroll-margin-top` on `.article-body h2/h3/h4`) and cannot be asserted
 * here: jsdom has no layout and does not implement scrolling. It was verified
 * in a real browser instead.
 */

function items(count: number): ArticleOutlineItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `article-h-${index}`,
    text: `第 ${index + 1} 节`,
    level: index % 3 === 0 ? 2 : 3,
  }));
}

describe("article outline", () => {
  it("renders every entry of a long outline", () => {
    const long = items(28);
    render(<ArticleOutline items={long} />);

    const nav = screen.getByRole("navigation", { name: "文章目录" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(28);
    expect(links[27]).toHaveTextContent("第 28 节");
  });

  /*
   * The rail is the outline's own scroll container at `lg`. Without a max
   * height it grew to 1064.5px in a 900px viewport and the last entries could
   * never be seen at any scroll position — the failure this batch fixes.
   */
  it("caps the rail height and lets it scroll instead of overflowing the viewport", () => {
    render(<ArticleOutline items={items(28)} />);

    const nav = screen.getByRole("navigation", { name: "文章目录" });
    expect(nav.className).toContain("lg:max-h-[calc(100vh-7rem)]");
    expect(nav.className).toContain("lg:overflow-y-auto");
    /* Scrolling the outline must not chain to the article underneath. */
    expect(nav.className).toContain("lg:overscroll-contain");
  });

  it("starts collapsed below lg so the outline does not precede the body", async () => {
    const user = userEvent.setup();
    render(<ArticleOutline items={items(28)} />);

    const toggle = screen.getByRole("button", { name: /目录/ });
    const list = screen.getByRole("list");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("28 节");
    expect(list.className).toContain("hidden");
    /* Still present in the DOM at lg — hiding is a breakpoint decision, not a state one. */
    expect(list.className).toContain("lg:flex");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(list.className).not.toContain("hidden");
  });

  it("collapses again on a second press", async () => {
    const user = userEvent.setup();
    render(<ArticleOutline items={items(3)} />);

    const toggle = screen.getByRole("button", { name: /目录/ });
    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("points every entry at the heading id the renderer emits", () => {
    render(<ArticleOutline items={items(3)} />);

    const nav = screen.getByRole("navigation", { name: "文章目录" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["#article-h-0", "#article-h-1", "#article-h-2"]);
  });

  it("indents nested levels and keeps level 2 flush", () => {
    render(<ArticleOutline items={items(3)} />);

    const entries = within(screen.getByRole("navigation", { name: "文章目录" })).getAllByRole(
      "listitem",
    );
    expect(entries[0].style.paddingLeft).toBe("0px");
    expect(entries[1].style.paddingLeft).toBe("12px");
  });
});
