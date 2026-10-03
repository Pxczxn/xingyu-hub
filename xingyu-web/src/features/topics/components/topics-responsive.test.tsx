import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopicsHero } from "./TopicsHero";
import { FeaturedTopics } from "./FeaturedTopics";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * Responsive contracts for the topics page.
 *
 * Why classes rather than layout: happy-dom does not compute layout, so a test
 * cannot assert "the page does not scroll sideways". What it CAN pin is the
 * contract that makes it not scroll sideways.
 *
 * That distinction matters for this project — a test asserting `className` is
 * usually pinning a bug's footprint. Here it is the opposite: each assertion
 * below states the INTENT ("this must be able to shrink on a phone"), and each
 * one corresponds to a real horizontal-overflow defect found on 2026-10-03 that
 * shipped precisely because the class was NOT there.
 */

/** TopicCard renders a <Link>, so every render needs a Router around it. */
function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const TOPICS: TopicSummary[] = [
  { id: "t1", name: "技术", slug: "tech", contentCount: 1 },
  { id: "t2", name: "设计", slug: "design", contentCount: 2 },
];

describe("TopicsHero — search box must be able to fit a phone", () => {
  it("goes full-width when the header stacks, instead of a fixed 320px", () => {
    renderInRouter(<TopicsHero keyword="" onKeywordChange={() => {}} />);
    const box = screen.getByLabelText("搜索话题").parentElement!;

    // The defect: `w-80 shrink-0` = a fixed 320px that cannot shrink. Next to the
    // title block that needs ~470px, so at 390px the page scrolled 52px sideways.
    expect(box.className).not.toContain("w-80 shrink-0");
    expect(box.className).toContain("w-full");
  });

  it("stacks the header below `sm` and only goes side-by-side above it", () => {
    renderInRouter(<TopicsHero keyword="" onKeywordChange={() => {}} />);
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(header.className).toContain("flex-col");
    expect(header.className).toContain("sm:flex-row");
  });
});

describe("FeaturedTopics — grid must scale down on a phone", () => {
  it("does not use a bare six-column grid", () => {
    renderInRouter(<FeaturedTopics topics={TOPICS} />);
    const grid = screen.getByTestId("featured-topics");

    // The defect: `grid grid-cols-6 gap-3` with no breakpoint. At 390px each cell
    // was 44px — narrower than the card's own icon plus label — so the content
    // pushed the page sideways.
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-6(\s|$)/);
  });

  it("keeps six columns as the wide-screen density", () => {
    renderInRouter(<FeaturedTopics topics={TOPICS} />);
    // Six is correct for a wide screen; the fix was to scale it, not drop it.
    expect(screen.getByTestId("featured-topics").className).toContain("lg:grid-cols-6");
  });

  it("starts at three columns so a phone gets tappable cells", () => {
    renderInRouter(<FeaturedTopics topics={TOPICS} />);
    expect(screen.getByTestId("featured-topics").className).toContain("grid-cols-3");
  });

  it("renders nothing when there are no topics", () => {
    const { container } = renderInRouter(<FeaturedTopics topics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
