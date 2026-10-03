import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopicVisual, topicVisualIconName } from "./TopicVisual";

describe("TopicVisual", () => {
  it("uses semantic icons for known topics", () => {
    render(<TopicVisual name="技术" stableKey="tech" />);
    expect(screen.getByTestId("topic-visual")).toHaveAttribute("data-topic-visual-icon", "Code2");
    expect(topicVisualIconName("设计", "design")).toBe("Palette");
  });

  it("uses a stable generic icon for unknown topics", () => {
    const { rerender } = render(<TopicVisual name="量子笔记" stableKey="quantum" />);
    const visual = screen.getByTestId("topic-visual");
    const icon = visual.getAttribute("data-topic-visual-icon");
    rerender(<TopicVisual name="量子笔记" stableKey="quantum" />);
    expect(screen.getByTestId("topic-visual")).toHaveAttribute("data-topic-visual-icon", icon);
  });
});
