import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ContentSummary } from "@/api/common.types";
import { DiscoverFocusGrid } from "./DiscoverFocusGrid";

/*
 * Contract tests for the editorial boundary.
 *
 * The focus block used to be built from array position (`items[0]` primary,
 * `items[1..3]` secondary). That is now driven by the server's `featured` flag, and
 * these tests pin the two things that matter:
 *
 *   1. ordinary content is NEVER promoted into the focus block to keep a shape alive;
 *   2. the shape follows the real pick count instead of the data being fitted to it.
 */

function item(id: string, featured: boolean | undefined, objectType = "ARTICLE"): ContentSummary {
  return { id, objectType, title: `标题 ${id}`, featured };
}

function renderGrid(items: ContentSummary[]) {
  return render(
    <MemoryRouter>
      <DiscoverFocusGrid items={items} />
    </MemoryRouter>,
  );
}

const focus = () => screen.queryByTestId("discover-focus-grid");
const primary = () => screen.queryByTestId("discover-focus-primary");
const secondaries = () => screen.queryAllByTestId("discover-focus-secondary");
const tail = () => screen.queryByTestId("discover-results");

describe("DiscoverFocusGrid — grouping follows the server's featured flag", () => {
  it("shows no focus block at all when nothing is an editorial pick", () => {
    renderGrid([item("a", false), item("b", false), item("c", false)]);

    // No picks means no editorial focus to present — so nothing claims to be one.
    expect(focus()).toBeNull();
    expect(primary()).toBeNull();
    expect(tail()).not.toBeNull();
    expect(screen.getAllByText(/^标题 /)).toHaveLength(3);
    expect(screen.queryByText("更多内容")).not.toBeInTheDocument();
  });

  it("never promotes ordinary content to fill a secondary slot", () => {
    renderGrid([
      item("pick", true),
      item("hot-1", false),
      item("hot-2", false),
      item("hot-3", false),
    ]);

    expect(primary()).toHaveTextContent("标题 pick");
    /*
     * ONE pick means ONE card in the focus block. The three hot items must not be
     * dressed up as secondary focus just to keep the familiar 1 + 2 shape.
     */
    expect(secondaries()).toHaveLength(0);
    expect(screen.queryByTestId("discover-focus-secondary-stack")).toBeNull();
    expect(focus()).toHaveAttribute("data-featured-count", "1");
    // They belong to the undifferentiated tail instead.
    expect(tail()).not.toBeNull();
    expect(screen.getByText("更多内容")).toBeInTheDocument();
  });

  it("renders one secondary for two picks", () => {
    renderGrid([item("p1", true), item("p2", true), item("hot", false)]);

    expect(primary()).toHaveTextContent("标题 p1");
    expect(secondaries()).toHaveLength(1);
    expect(secondaries()[0]).toHaveTextContent("标题 p2");
    expect(focus()).toHaveAttribute("data-featured-count", "2");
  });

  it("renders two secondaries for three picks", () => {
    renderGrid([item("p1", true), item("p2", true), item("p3", true), item("hot", false)]);

    expect(focus()).toHaveAttribute("data-featured-count", "3");
    expect(secondaries()).toHaveLength(2);
    expect(screen.getByTestId("discover-focus-secondary-stack")).toBeInTheDocument();
  });

  it("sends picks beyond the shape into the tail, unlabelled", () => {
    renderGrid([
      item("p1", true),
      item("p2", true),
      item("p3", true),
      item("p4", true),
      item("hot", false),
    ]);

    expect(focus()).toHaveAttribute("data-featured-count", "4");
    // The shape does not grow to fit a fourth pick.
    expect(secondaries()).toHaveLength(2);
    // p4 is a pick but shares the tail with ordinary content — the remainder is
    // deliberately undifferentiated, and carries no marker.
    expect(tail()).not.toBeNull();
    expect(tail()).toHaveTextContent("标题 p4");
    expect(tail()).toHaveTextContent("标题 hot");
  });

  it("treats an absent featured flag as NOT a pick", () => {
    // Continue-reading and search leave the field undefined. Discover always sets it, so an
    // absent value must fall on the safe side rather than being treated as a pick.
    renderGrid([item("unknown", undefined), item("pick", true)]);

    expect(primary()).toHaveTextContent("标题 pick");
    expect(secondaries()).toHaveLength(0);
    expect(focus()).toHaveAttribute("data-featured-count", "1");
  });
});
