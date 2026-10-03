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
});
