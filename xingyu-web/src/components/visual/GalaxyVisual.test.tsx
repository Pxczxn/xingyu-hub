import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GalaxyVisual } from "./GalaxyVisual";

describe("GalaxyVisual", () => {
  it("keeps a galaxy composition stable for the same slug", () => {
    const { rerender } = render(
      <GalaxyVisual stableKey="xingyu-official" official variant="spotlight" />,
    );
    const visual = screen.getByTestId("galaxy-visual");
    const composition = visual.getAttribute("data-galaxy-visual-composition");

    rerender(<GalaxyVisual stableKey="xingyu-official" official variant="spotlight" />);

    expect(screen.getByTestId("galaxy-visual")).toHaveAttribute(
      "data-galaxy-visual-composition",
      composition,
    );
  });

  it("does not depend on an image or random data", () => {
    render(<GalaxyVisual stableKey="community-space" variant="compact" />);
    expect(screen.getByTestId("galaxy-visual").querySelector("img")).toBeNull();
  });
});
