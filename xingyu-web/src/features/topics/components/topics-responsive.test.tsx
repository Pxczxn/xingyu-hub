import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopicsFilterBar } from "./TopicsFilterBar";
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
 *
 * 2026-10-13 (批次 04): the search box moved out of `TopicsHero` into its own
 * `TopicsFilterBar`, and 热门话题 changed from a six-column grid of cards into a
 * wrapping chip row. Both describe blocks were rewritten against the new
 * structure — the defects they guard against are the same ones.
 */

/** Everything here renders a <Link>, so every render needs a Router around it. */
function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const TOPICS: TopicSummary[] = [
  { id: "t1", name: "技术", slug: "tech", contentCount: 1 },
  { id: "t2", name: "设计", slug: "design", contentCount: 2 },
];

describe("TopicsFilterBar — the search box must fit a phone", () => {
  it("goes full-width when the row wraps, instead of a fixed 320px", () => {
    renderInRouter(<TopicsFilterBar keyword="" onKeywordChange={() => {}} />);
    const box = screen.getByLabelText("搜索话题").parentElement!;

    // The defect: `w-80 shrink-0` = a fixed 320px that cannot shrink. Next to the
    // title block that needs ~470px, so at 390px the page scrolled 52px sideways.
    expect(box.className).not.toContain("w-80 shrink-0");
    expect(box.className).toContain("w-full");
  });

  it("wraps, so the clear control never squeezes the field", () => {
    renderInRouter(<TopicsFilterBar keyword="设计" onKeywordChange={() => {}} />);
    const bar = screen.getByLabelText("搜索话题").closest("div")!;

    // The row holds a field and a clear button. Without `flex-wrap` the button
    // takes its width out of the field at 390px, which is the same class of
    // defect as the fixed 320px — just with a different victim.
    expect(bar.className).toContain("flex-wrap");
  });

  it("is only sticky from `lg` up, under the shell header", () => {
    renderInRouter(<TopicsFilterBar keyword="" onKeywordChange={() => {}} />);
    const bar = screen.getByLabelText("搜索话题").closest("div")!;

    /*
     * `lg:top-24` (96px) is the offset for the shell header, which itself only
     * shows its desktop layout from `lg`. Below `lg` the bar is already at the top
     * of the scroll, so stickiness there would only cost height. Same value as
     * TopicHeader / ArticleDetailPage / RulesPage.
     */
    expect(bar.className).toContain("lg:sticky");
    expect(bar.className).toContain("lg:top-24");
  });

  it("renders no clear control until there is something to clear", () => {
    const { unmount } = renderInRouter(<TopicsFilterBar keyword="" onKeywordChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "清除搜索" })).not.toBeInTheDocument();
    unmount();

    renderInRouter(<TopicsFilterBar keyword="设计" onKeywordChange={() => {}} />);
    expect(screen.getByRole("button", { name: "清除搜索" })).toBeInTheDocument();
  });
});

describe("FeaturedTopics — the chip row must scale down on a phone", () => {
  it("wraps instead of pushing the page sideways", () => {
    renderInRouter(<FeaturedTopics topics={TOPICS} />);
    const row = screen.getByTestId("featured-topics");

    // The defect (2026-10-03): `grid grid-cols-6 gap-3` with no breakpoint. At
    // 390px each cell was 44px — narrower than the card's own icon plus label — so
    // the content pushed the page sideways. Chips cannot fail that way, but they
    // do overflow if they are not allowed to wrap.
    expect(row.className).toContain("flex-wrap");
  });

  it("caps each chip at the row width, so a long name truncates instead of overflowing", () => {
    renderInRouter(
      <FeaturedTopics
        topics={[
          {
            id: "t1",
            slug: "long",
            name: "一个非常非常长的话题名称，长到足以把整行撑破",
            contentCount: 9,
          },
        ]}
      />,
    );

    const link = screen.getByRole("link");
    expect(link.className).toContain("max-w-full");
    // The name is the only flexible part of a chip — the visual and the padding are
    // fixed — so an un-truncated label is exactly what widens it past the row.
    expect(within(link).getByText(/一个非常非常长的话题名称/).className).toContain("truncate");
  });

  it("renders nothing when there are no topics", () => {
    const { container } = renderInRouter(<FeaturedTopics topics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
