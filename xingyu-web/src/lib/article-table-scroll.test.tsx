import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleTableScroll } from "./article-table-scroll";
import { hasHorizontalOverflow } from "./horizontal-overflow";

describe("hasHorizontalOverflow", () => {
  it("only reports real overflow, with a one-pixel rounding tolerance", () => {
    expect(hasHorizontalOverflow(600, 300)).toBe(true);
    expect(hasHorizontalOverflow(302, 300)).toBe(true);
    expect(hasHorizontalOverflow(301, 300)).toBe(false);
    expect(hasHorizontalOverflow(300, 300)).toBe(false);
    expect(hasHorizontalOverflow(299, 300)).toBe(false);
  });
});

describe("ArticleTableScroll", () => {
  function renderTable() {
    return render(
      <ArticleTableScroll>
        <tbody>
          <tr>
            <td>单元格内容</td>
          </tr>
        </tbody>
      </ArticleTableScroll>,
    );
  }

  function viewportOf() {
    const table = screen.getByRole("table");
    return table.parentElement as HTMLDivElement;
  }

  it("adds no affordance or tab stop while the table fits", () => {
    renderTable();

    const viewport = viewportOf();
    expect(viewport).toHaveClass("article-table-scroll");
    expect(viewport).not.toHaveAttribute("tabindex");
    expect(viewport).not.toHaveAttribute("role");
    expect(screen.queryByTestId("article-table-overflow-hint")).not.toBeInTheDocument();
  });

  it("becomes a labelled keyboard-scrollable region only when it overflows", () => {
    renderTable();
    const viewport = viewportOf();

    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(viewport).toHaveAttribute("tabindex", "0");
    expect(viewport).toHaveAttribute("role", "region");
    expect(viewport).toHaveAttribute("aria-label", "表格，可横向滚动");
    expect(screen.getByTestId("article-table-overflow-hint")).toBeInTheDocument();
  });

  it("hides the hint once the reader reaches the right edge", () => {
    renderTable();
    const viewport = viewportOf();

    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 0,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("article-table-overflow-hint")).toBeInTheDocument();

    viewport.scrollLeft = 320;
    fireEvent.scroll(viewport);

    expect(screen.queryByTestId("article-table-overflow-hint")).not.toBeInTheDocument();
    // It is still a scroll region: the table did not shrink, the reader is just
    // at the end of it.
    expect(viewport).toHaveAttribute("role", "region");
  });
});
