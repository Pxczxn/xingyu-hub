import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ContentSummary } from "@/api/common.types";
import { TopicContentItem } from "./TopicContentItem";

/*
 * Metadata contract for a topic content row.
 *
 * The line used to read `author · 27 天前 [文章]`, where the timestamp was
 * `search_document.indexed_at` — an index-write time, not a content time — and the 「·」
 * was written between two hardcoded slots, so it was left dangling in front of the type
 * chip whenever the author was missing (which the payload allows).
 *
 * These pin the three ways that could regress: a timestamp creeping back, a separator with
 * nothing before it, and an empty meta container.
 */

const meta = () => screen.queryByTestId("topic-item-meta");

function renderItem(item: ContentSummary) {
  return render(
    <MemoryRouter>
      <TopicContentItem item={item} />
    </MemoryRouter>,
  );
}

describe("TopicContentItem metadata", () => {
  it("renders no timestamp, even when the payload carries updatedAt", () => {
    renderItem({
      id: "c1",
      objectType: "ARTICLE",
      title: "一篇文章",
      authorName: "林深",
      updatedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // A reader would take 「27 天前」 for a publication/update time. It is neither.
    expect(screen.queryByText(/天前|小时前|分钟前/)).toBeNull();
    expect(meta()).toHaveTextContent("林深");
  });

  it("leaves no dangling separator when the author is missing", () => {
    renderItem({ id: "c1", objectType: "ARTICLE", title: "无作者条目" });

    // Used to render 「· 文章」 — a separator with nothing in front of it.
    expect(meta()).not.toBeNull();
    expect(meta()!.textContent).toBe("文章");
    expect(meta()!.textContent).not.toContain("·");
  });

  it("renders no meta line at all when there is nothing to put in it", () => {
    renderItem({ id: "c1", title: "只有标题的条目" });

    // No empty container and no stray gap above a title that has no byline.
    expect(meta()).toBeNull();
    expect(screen.getByText("只有标题的条目")).toBeInTheDocument();
  });
});
