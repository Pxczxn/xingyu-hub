import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopicDiscoverySection } from "./TopicDiscoverySection";
import { SearchField } from "@/components/shared/SearchField";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * Responsive contracts for the topics plaza discovery area.
 *
 * Why classes rather than layout: happy-dom does not compute layout, so a test
 * cannot assert "the page does not scroll sideways". What it CAN pin is the
 * contract that makes it not scroll sideways — each assertion below states the
 * INTENT, not a pixel value.
 */

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const HOT: TopicSummary[] = [
  { id: "t1", name: "技术", slug: "tech", contentCount: 9 },
  { id: "t2", name: "设计", slug: "design", contentCount: 4 },
];

const RECENT: TopicSummary[] = [
  {
    id: "t3",
    name: "一个非常非常长的话题名称，长到足以把整行撑破",
    slug: "long",
    contentCount: 2,
    lastPublishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

describe("TopicDiscoverySection — two modules must fit a phone", () => {
  it("is two equal columns on desktop and one column on phones", () => {
    renderInRouter(<TopicDiscoverySection hot={HOT} recent={RECENT} />);
    const grid = screen.getByTestId("topic-discovery");

    // 1:1 on md+, single column below it. Both modules are peers, so they share one
    // grid track definition instead of two hand-tuned widths.
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("md:grid-cols-2");
  });

  it("truncates a long topic name instead of widening the row", () => {
    renderInRouter(<TopicDiscoverySection hot={[]} recent={RECENT} />);

    const link = screen.getByRole("link", { name: /一个非常非常长的话题名称/ });
    const name = link.querySelector("span.truncate");
    expect(name).not.toBeNull();
    // `min-w-0` on the flex item is what lets `truncate` actually clamp: without it
    // the item refuses to shrink below its content and the row overflows.
    expect(name!.className).toContain("truncate");
  });

  it("renders only the module it has data for, without leaving an empty column", () => {
    renderInRouter(<TopicDiscoverySection hot={HOT} recent={[]} />);

    expect(screen.getByRole("heading", { name: "热门话题" })).toBeInTheDocument();
    // No placeholder column, no empty heading for the module without data.
    expect(screen.queryByRole("heading", { name: "最近活跃" })).not.toBeInTheDocument();
    // A lone module takes the full row instead of sitting beside a blank column.
    expect(screen.getByTestId("topic-discovery").className).toContain("md:grid-cols-1");
  });

  it("renders nothing when neither module has data", () => {
    const { container } = renderInRouter(<TopicDiscoverySection hot={[]} recent={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the real evidence, not a generic label", () => {
    renderInRouter(<TopicDiscoverySection hot={HOT} recent={RECENT} />);

    // 热门 → 公开内容数；最近活跃 → 真实发布时间（3 小时前），不是「刚刚更新」。
    expect(screen.getByText("9 篇内容")).toBeInTheDocument();
    expect(screen.getByText("3 小时前")).toBeInTheDocument();
  });
});

describe("SearchField — the field must fit the section header", () => {
  it("is full width on a phone and bounded on desktop", () => {
    renderInRouter(
      <SearchField value="" onChange={() => {}} ariaLabel="搜索话题" placeholder="" />,
    );
    const field = screen.getByRole("textbox", { name: "搜索话题" }).parentElement!;

    // Not a fixed 320px that cannot shrink next to the section title.
    expect(field.className).toContain("w-full");
    expect(field.className).toContain("sm:w-64");
    expect(field.className).not.toContain("w-80");
  });

  it("offers a clear control only when there is something to clear", () => {
    const onChange = vi.fn();
    const { unmount } = renderInRouter(
      <SearchField value="" onChange={onChange} ariaLabel="搜索话题" placeholder="" />,
    );
    expect(screen.queryByRole("button", { name: "清除搜索" })).not.toBeInTheDocument();
    unmount();

    renderInRouter(
      <SearchField value="设计" onChange={onChange} ariaLabel="搜索话题" placeholder="" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
