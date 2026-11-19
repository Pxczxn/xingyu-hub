import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
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

  it("can hide the rail eyebrow and notify the host on a jump", async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    render(
      <ArticleOutline items={items(2)} rail hideEyebrow onItemSelect={onItemSelect} />,
    );

    expect(within(screen.getByRole("navigation", { name: "文章目录" })).queryByText("目录")).toBeNull();
    await user.click(screen.getByRole("link", { name: "第 1 节" }));
    expect(onItemSelect).toHaveBeenCalledWith("article-h-0");
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

const tracked = [
  { id: "h2-a", text: "阅读布局", level: 2 as const },
  { id: "h3-a", text: "标题层级", level: 3 as const },
  { id: "h2-b", text: "滚动目录", level: 2 as const },
];

function renderTracked(label = "文章目录") {
  return render(
    <div>
      {tracked.map((item) => (
        <h2 key={item.id} id={item.id}>
          {item.text}
        </h2>
      ))}
      <ArticleOutline items={tracked} label={label} rail />
    </div>,
  );
}

let documentTops: Record<string, number> = {};

function placeHeadings(tops: Record<string, number>) {
  documentTops = tops;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = documentTops[this.id];
    const y = top == null ? 0 : top - window.scrollY;
    return {
      top: y,
      bottom: y + (top == null ? 0 : 24),
      left: 0,
      right: top == null ? 0 : 200,
      width: top == null ? 0 : 200,
      height: top == null ? 0 : 24,
      x: 0,
      y,
      toJSON() {
        return {};
      },
    } as DOMRect;
  });
}

function setScroll(scrollY: number, scrollHeight = 3200, viewportHeight = 900) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewportHeight });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

function currentLink(label: string) {
  return within(screen.getByRole("navigation", { name: label }))
    .getAllByRole("link")
    .find((link) => link.getAttribute("aria-current") === "location");
}

describe("article outline current heading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    documentTops = {};
  });

  it("leaves every item unselected before the first heading", () => {
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(0);

    expect(currentLink("文章目录")).toBeUndefined();
  });

  it("marks the H2, then the H3 under it, then the next H2", () => {
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });

    setScroll(400);
    expect(currentLink("文章目录")).toHaveTextContent("阅读布局");

    setScroll(900);
    expect(currentLink("文章目录")).toHaveTextContent("标题层级");

    setScroll(1500);
    expect(currentLink("文章目录")).toHaveTextContent("滚动目录");
  });

  it("marks the clicked heading immediately", async () => {
    const user = userEvent.setup();
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(0);

    await user.click(screen.getByRole("link", { name: "标题层级" }));

    expect(currentLink("文章目录")).toHaveTextContent("标题层级");
    expect(screen.getByRole("link", { name: "阅读布局" })).not.toHaveAttribute("aria-current");
  });

  it("follows the page again after a click once the reader scrolls away", async () => {
    const user = userEvent.setup();
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(0);
    await user.click(screen.getByRole("link", { name: "滚动目录" }));
    expect(currentLink("文章目录")).toHaveTextContent("滚动目录");
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });
    });

    setScroll(400);
    expect(currentLink("文章目录")).toHaveTextContent("阅读布局");
  });

  it("keeps a clicked heading when the page cannot scroll it up to the reading line", async () => {
    const user = userEvent.setup();
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(0, 900, 900);
    await user.click(screen.getByRole("link", { name: "标题层级" }));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(currentLink("文章目录")).toHaveTextContent("标题层级");
  });

  it("marks the last heading at the end of the page", () => {
    renderTracked();
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(2300);

    expect(currentLink("文章目录")).toHaveTextContent("滚动目录");
  });

  it("uses the same current heading for the guide and rules labels", () => {
    const { unmount } = renderTracked("指南目录");
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(900);
    expect(currentLink("指南目录")).toHaveTextContent("标题层级");
    const guideIndent = screen.getByRole("link", { name: "标题层级" }).parentElement;
    expect(guideIndent?.style.paddingLeft).toBe("12px");
    unmount();

    renderTracked("规则目录");
    placeHeadings({ "h2-a": 400, "h3-a": 900, "h2-b": 1500 });
    setScroll(900);
    expect(currentLink("规则目录")).toHaveTextContent("标题层级");
    expect(screen.getByRole("link", { name: "阅读布局" })).not.toHaveAttribute("aria-current");
  });
});
