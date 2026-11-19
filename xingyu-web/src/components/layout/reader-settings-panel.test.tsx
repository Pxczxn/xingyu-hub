import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  READER_FONT_SIZES,
  READER_LINE_HEIGHT_STEPS,
  ReaderSettingsButton,
  ReaderTools,
} from "./ReaderFrame";

describe("ReaderSettingsButton panel", () => {
  it("keeps each label with its controls inside the reading column and applies the chosen step", async () => {
    const user = userEvent.setup();
    const onFontSize = vi.fn();
    const onLineHeight = vi.fn();
    render(
      <ReaderSettingsButton
        fontSize={18}
        lineHeight={1.9}
        onFontSize={onFontSize}
        onLineHeight={onLineHeight}
      />,
    );

    await user.click(screen.getByRole("button", { name: "阅读设置" }));
    const dialog = screen.getByRole("dialog", { name: "阅读设置" });
    const tools = within(dialog).getByRole("group", { name: "阅读工具" });
    const column = tools.parentElement?.parentElement;

    expect(column?.className).toContain("max-w-[var(--reading-measure)]");
    expect(column).toContainElement(within(dialog).getByRole("heading", { name: "阅读设置" }));

    const fontLabel = within(tools).getByText("字号");
    const fontRow = fontLabel.parentElement;
    expect(fontRow).toContainElement(within(tools).getByRole("button", { name: "减小字号" }));
    expect(fontRow).toContainElement(within(tools).getByRole("button", { name: "增大字号" }));
    expect(fontRow?.className).not.toContain("justify-between");

    const lineLabel = within(tools).getByText("行距");
    const lineRow = lineLabel.parentElement;
    const lineButtons = within(lineRow as HTMLElement).getAllByRole("button");
    expect(lineButtons.map((button) => button.textContent)).toEqual(
      READER_LINE_HEIGHT_STEPS.map((step) => step.label),
    );
    expect(lineRow?.className).not.toContain("justify-between");
    expect(fontLabel.className).toBe(lineLabel.className);

    await user.click(within(tools).getByRole("button", { name: "增大字号" }));
    expect(onFontSize).toHaveBeenCalledWith(READER_FONT_SIZES[2]);

    await user.click(within(lineRow as HTMLElement).getByRole("button", { name: "宽" }));
    expect(onLineHeight).toHaveBeenCalledWith(2);
    await user.click(within(lineRow as HTMLElement).getByRole("button", { name: "紧" }));
    expect(onLineHeight).toHaveBeenCalledWith(1.8);
  });
});

describe("ReaderTools rail arrangement", () => {
  it("keeps the right-rail rows spread between the label and the controls", () => {
    render(
      <ReaderTools
        fontSize={18}
        fontSizeSteps={READER_FONT_SIZES}
        lineHeight={1.9}
        lineHeightSteps={READER_LINE_HEIGHT_STEPS}
        onFontSize={vi.fn()}
        onLineHeight={vi.fn()}
      />,
    );

    const fontRow = screen.getByText("字号").parentElement;
    expect(fontRow?.className).toContain("justify-between");
    expect(fontRow).toContainElement(screen.getByRole("button", { name: "减小字号" }));
    expect(fontRow).toContainElement(screen.getByRole("button", { name: "增大字号" }));
  });
});
