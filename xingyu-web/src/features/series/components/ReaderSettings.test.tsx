import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReaderSettings } from "./ReaderSettings";

const LAYOUT_TOKENS = ["h-12", "w-full", "px-3", "whitespace-nowrap"] as const;

function widthButtons() {
  const group = screen.getByRole("group", { name: "阅读宽度" });
  return {
    group,
    buttons: Array.from(group.querySelectorAll(":scope > button")),
  };
}

describe("ReaderSettings width options", () => {
  it("keeps 窄 / 适中 / 宽 on one equal-height row in the stacked rail", async () => {
    const user = userEvent.setup();
    const onLayoutChange = vi.fn();
    const { rerender } = render(
      <ReaderSettings
        stacked
        fontSize={18}
        layout="medium"
        onFontSizeChange={vi.fn()}
        onLayoutChange={onLayoutChange}
        onReset={vi.fn()}
      />,
    );

    const { group, buttons } = widthButtons();
    expect(buttons.map((button) => button.textContent)).toEqual(["窄", "适中", "宽"]);
    expect(group).toHaveClass("grid", "grid-cols-3", "w-full");

    const widthBlock = group.parentElement;
    expect(widthBlock).toHaveClass("flex-col");
    expect(widthBlock?.querySelector(":scope > span")).toHaveTextContent("阅读宽度");

    for (const button of buttons) {
      for (const token of LAYOUT_TOKENS) {
        expect(button).toHaveClass(token);
      }
      expect(button.className).not.toMatch(/(?:^|\s)py-/);
    }

    const selected = screen.getByRole("button", { name: "适中" });
    const unselected = screen.getByRole("button", { name: "窄" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(unselected).toHaveAttribute("aria-pressed", "false");
    expect(selected).toHaveClass("font-medium");
    expect(unselected).not.toHaveClass("font-medium");
    for (const token of LAYOUT_TOKENS) {
      expect(selected).toHaveClass(token);
      expect(unselected).toHaveClass(token);
    }

    await user.click(unselected);
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange).toHaveBeenCalledWith("narrow");

    rerender(
      <ReaderSettings
        stacked
        fontSize={18}
        layout="narrow"
        onFontSizeChange={vi.fn()}
        onLayoutChange={onLayoutChange}
        onReset={vi.fn()}
      />,
    );
    const after = widthButtons();
    expect(after.buttons.map((button) => button.textContent)).toEqual(["窄", "适中", "宽"]);
    for (const button of after.buttons) {
      for (const token of LAYOUT_TOKENS) {
        expect(button).toHaveClass(token);
      }
    }
  });
});
