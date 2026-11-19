import { describe, expect, it } from "vitest";
import { activeHeadingId, scrollOutlineItemIntoView } from "./article-outline-active";

const headings = [
  { id: "h2-a", top: 400 },
  { id: "h3-a", top: 900 },
  { id: "h2-b", top: 1500 },
  { id: "h3-b", top: 1900 },
];

const viewport = {
  viewportHeight: 900,
  scrollHeight: 3200,
  markerOffset: 80,
};

describe("activeHeadingId", () => {
  it("does not highlight a heading before the first one reaches the reading line", () => {
    expect(activeHeadingId(headings, { ...viewport, scrollY: 0 })).toBeNull();
  });

  it("highlights the H2 once the reading line passes it", () => {
    expect(activeHeadingId(headings, { ...viewport, scrollY: 400 })).toBe("h2-a");
  });

  it("prefers the H3 under that H2 once the line reaches the H3", () => {
    expect(activeHeadingId(headings, { ...viewport, scrollY: 900 })).toBe("h3-a");
  });

  it("keeps the H3 until the next H2 crosses the reading line", () => {
    expect(activeHeadingId(headings, { ...viewport, scrollY: 1200 })).toBe("h3-a");
    expect(activeHeadingId(headings, { ...viewport, scrollY: 1500 })).toBe("h2-b");
  });

  it("follows a forward scroll without jumping back to an earlier heading", () => {
    const seen = [0, 350, 500, 1000, 1400, 1600].map((scrollY) =>
      activeHeadingId(headings, { ...viewport, scrollY }),
    );
    expect(seen).toEqual([null, "h2-a", "h2-a", "h3-a", "h3-a", "h2-b"]);
  });

  it("selects the last heading when the page is scrolled to the end", () => {
    expect(
      activeHeadingId(headings, {
        ...viewport,
        scrollY: viewport.scrollHeight - viewport.viewportHeight,
      }),
    ).toBe("h3-b");
  });

  it("does not treat a page that cannot scroll as already finished", () => {
    expect(
      activeHeadingId(headings, {
        scrollY: 0,
        viewportHeight: 4000,
        scrollHeight: 3200,
        markerOffset: 80,
      }),
    ).toBeNull();
  });

  it("picks the last heading above the line when several are in view, not an arbitrary one", () => {
    expect(activeHeadingId(headings, { ...viewport, scrollY: 1100 })).toBe("h3-a");
  });
});

describe("scrollOutlineItemIntoView", () => {
  it("moves only the outline scroller when the current item is clipped", () => {
    const scroller = document.createElement("div");
    const item = document.createElement("a");
    scroller.append(item);
    document.body.append(scroller);
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 800 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
    scroller.getBoundingClientRect = () =>
      ({ top: 100, bottom: 300, left: 0, right: 200, width: 200, height: 200 }) as DOMRect;
    item.getBoundingClientRect = () =>
      ({ top: 340, bottom: 364, left: 0, right: 180, width: 180, height: 24 }) as DOMRect;
    const before = window.scrollY;

    scrollOutlineItemIntoView(item);

    expect(scroller.scrollTop).toBe(64);
    expect(window.scrollY).toBe(before);
    scroller.remove();
  });
});
