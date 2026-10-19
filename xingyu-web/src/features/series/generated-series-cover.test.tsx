import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GeneratedSeriesCover } from "./components/GeneratedSeriesCover";
import { SeriesCover } from "@/components/visual/SeriesCover";

describe("GeneratedSeriesCover", () => {
  it("generates the same decorative variant for the same series key", () => {
    const { rerender } = render(
      <GeneratedSeriesCover seriesKey="series-1:hello" title="星语手记" />,
    );
    const firstVariant = screen.getByTestId("generated-series-cover").dataset.coverVariant;

    rerender(<GeneratedSeriesCover seriesKey="series-1:hello" title="更新后的标题" />);

    expect(screen.getByTestId("generated-series-cover")).toHaveAttribute(
      "data-cover-key",
      "series-1:hello",
    );
    expect(screen.getByTestId("generated-series-cover").dataset.coverVariant).toBe(firstVariant);
  });

  it("keeps thumbnail and cover compositions free of dynamic title text", () => {
    const { rerender } = render(
      <SeriesCover stableKey="series-1:hello" title="后端工程入门" variant="thumbnail" />,
    );
    expect(screen.getByTestId("generated-series-cover")).toHaveAttribute(
      "data-cover-key",
      "series-1:hello",
    );
    expect(screen.queryByText("后端工程入门")).not.toBeInTheDocument();

    rerender(<SeriesCover stableKey="series-1:hello" title="后端工程入门" variant="cover" />);
    expect(screen.queryByText("后端工程入门")).not.toBeInTheDocument();
  });

  it("gives the plaza's poster variant the same deterministic identity and book shape", () => {
    render(<SeriesCover stableKey="series-7:night-study" title="深夜书房" variant="poster" />);
    const cover = screen.getByTestId("generated-series-cover");

    /* 3:4 jacket, sized by the caller's column width rather than a fixed height. */
    expect(cover.className).toContain("aspect-[3/4]");
    expect(cover.className).toContain("w-full");
    expect(cover).toHaveAttribute("data-cover-key", "series-7:night-study");
    /* Presentation only: the title next to the cover is the only title text. */
    expect(screen.queryByText("深夜书房")).not.toBeInTheDocument();
    expect(screen.getByText("XINGYU SERIES")).toBeInTheDocument();
  });
});
