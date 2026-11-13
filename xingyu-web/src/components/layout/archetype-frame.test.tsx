import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ArchetypeFrame } from "./ArchetypeFrame";

describe("ArchetypeFrame SK3 rail", () => {
  it("keeps the default rail column at lg", () => {
    const { container } = render(
      <ArchetypeFrame skeleton="SK3" rail={<p>说明</p>}>
        <p>表单</p>
      </ArchetypeFrame>,
    );
    expect(container.firstElementChild?.className).toContain(
      "lg:grid-cols-[minmax(0,1fr)_280px]",
    );
    expect(container.firstElementChild?.className).not.toContain("min-[1176px]:grid");
  });

  it("delays the settings rail until the measured nested width", () => {
    const { container } = render(
      <ArchetypeFrame skeleton="SK3" railAt="settings" rail={<p>说明</p>}>
        <p>表单</p>
      </ArchetypeFrame>,
    );
    const className = container.firstElementChild?.className ?? "";
    expect(className).toContain("min-[1176px]:grid-cols-[minmax(0,1fr)_280px]");
    expect(className).not.toContain("lg:grid");
    expect(container).toHaveTextContent("说明");
    expect(container).toHaveTextContent("表单");
  });

  it("does not add a rail grid when the page has no rail", () => {
    const { container } = render(
      <ArchetypeFrame skeleton="SK3" railAt="settings">
        <p>表单</p>
      </ArchetypeFrame>,
    );
    expect(container.firstElementChild?.className).not.toContain("grid-cols");
  });
});
