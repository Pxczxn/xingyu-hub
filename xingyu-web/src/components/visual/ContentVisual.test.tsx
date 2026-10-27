import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentVisual, contentVisualIconName } from "./ContentVisual";

describe("ContentVisual", () => {
  it("maps known object types to semantic icons", () => {
    expect(contentVisualIconName("ARTICLE", "article-1")).toMatch(/FileText|AlignLeft/);
    expect(contentVisualIconName("SERIES", "series-1")).toMatch(/BookOpen|LibraryBig/);
    expect(contentVisualIconName("MOMENT", "moment-1")).toBe("MessageCircle");
  });

  it("uses a quiet compact composition without the full type label", () => {
    render(<ContentVisual stableKey="compact-1" objectType="ARTICLE" variant="compact" />);
    const visual = screen.getByTestId("content-visual");
    expect(visual).toHaveAttribute("data-content-visual-variant", "compact");
    expect(visual).not.toHaveTextContent("ARTICLE");
  });

  it("keeps card and feature variants explicit", () => {
    const { rerender } = render(
      <ContentVisual stableKey="card-1" objectType="SERIES" variant="card" />,
    );
    expect(screen.getByTestId("content-visual")).toHaveAttribute(
      "data-content-visual-variant",
      "card",
    );
    rerender(<ContentVisual stableKey="feature-1" objectType="MOMENT" variant="feature" />);
    expect(screen.getByTestId("content-visual")).toHaveAttribute(
      "data-content-visual-variant",
      "feature",
    );
  });

  it("renders a stable fallback for unknown types and preserves real media", () => {
    const { rerender } = render(<ContentVisual stableKey="unknown-1" objectType="UNKNOWN" />);
    const fallback = screen.getByTestId("content-visual");
    expect(fallback).toHaveAttribute("data-content-visual-type", "UNKNOWN");
    const icon = fallback.getAttribute("data-content-visual-icon");

    rerender(<ContentVisual stableKey="unknown-1" objectType="UNKNOWN" />);
    expect(screen.getByTestId("content-visual")).toHaveAttribute("data-content-visual-icon", icon);

    rerender(<ContentVisual stableKey="article-1" objectType="ARTICLE" cover="/real-cover.jpg" />);
    expect(screen.queryByTestId("content-visual")).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/real-cover.jpg"]')).toBeInTheDocument();
  });

  it("falls back to the plate when the cover image fails to load", () => {
    render(<ContentVisual stableKey="broken-1" objectType="ARTICLE" cover="/missing-cover.jpg" />);
    const img = document.querySelector('img[src="/missing-cover.jpg"]');
    expect(img).toBeInTheDocument();
    expect(screen.queryByTestId("content-visual")).not.toBeInTheDocument();

    fireEvent.error(img!);

    expect(document.querySelector('img[src="/missing-cover.jpg"]')).not.toBeInTheDocument();
    expect(screen.getByTestId("content-visual")).toBeInTheDocument();
  });

  it("retries with the new cover after a failure instead of staying broken", () => {
    const { rerender } = render(
      <ContentVisual stableKey="broken-2" objectType="ARTICLE" cover="/missing-cover.jpg" />,
    );
    fireEvent.error(document.querySelector('img[src="/missing-cover.jpg"]')!);
    expect(screen.getByTestId("content-visual")).toBeInTheDocument();

    rerender(<ContentVisual stableKey="broken-2" objectType="ARTICLE" cover="/real-cover.jpg" />);
    expect(screen.queryByTestId("content-visual")).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/real-cover.jpg"]')).toBeInTheDocument();
  });
});
