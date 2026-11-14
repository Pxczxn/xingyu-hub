import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CanvasFrame } from "./CanvasFrame";

function frame() {
  return screen.getByRole("toolbar", { name: "编辑工具" }).parentElement as HTMLElement;
}

function inspector() {
  return screen.getByRole("complementary", { name: "检视" });
}

describe("CanvasFrame", () => {
  it("keeps the desktop three-column track", () => {
    render(
      <CanvasFrame toolbar={<span>工具</span>} inspector={<p>设置</p>}>
        <p>正文</p>
      </CanvasFrame>,
    );
    expect(frame().className).toContain("lg:grid-cols-[48px_minmax(0,1fr)_320px]");
    expect(inspector().className.split(" ")).toContain("hidden");
    expect(inspector().className).not.toContain("max-lg:fixed");
  });

  it("leaves an opened inspector in the document flow unless the page asks for an overlay", () => {
    render(
      <CanvasFrame toolbar={<span>工具</span>} inspector={<p>设置</p>} inspectorOpen>
        <p>正文</p>
      </CanvasFrame>,
    );
    expect(inspector().className.split(" ")).not.toContain("hidden");
    expect(inspector().className).not.toContain("max-lg:fixed");
    expect(frame().className).toContain("lg:grid-cols-[48px_minmax(0,1fr)_320px]");
  });

  it("pins an opened inspector over the canvas below lg", () => {
    render(
      <CanvasFrame
        toolbar={<span>工具</span>}
        inspector={<p>设置</p>}
        inspectorOpen
        overlayInspector
      >
        <p>正文</p>
      </CanvasFrame>,
    );
    const className = inspector().className;
    expect(className).toContain("max-lg:fixed");
    expect(className).toContain("max-lg:inset-x-0");
    expect(className).toContain("max-lg:overflow-y-auto");
    expect(className).toContain("lg:[contain:paint]");
    expect(className).toContain("max-lg:[contain:paint]");
    expect(className).toContain(
      "max-lg:top-[calc(var(--shell-header-height)+var(--xy-editor-toolbar-h,0px))]",
    );
    expect(className.split(" ")).not.toContain("hidden");
    expect(frame().className).toContain("lg:grid-cols-[48px_minmax(0,1fr)_320px]");
  });
});
