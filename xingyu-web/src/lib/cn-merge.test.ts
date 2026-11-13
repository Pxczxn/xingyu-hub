import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn design-system type scale", () => {
  it("keeps a heading size next to a text color", () => {
    expect(cn("text-h1 text-primary")).toBe("text-h1 text-primary");
    expect(cn("text-h2", "text-primary")).toBe("text-h2 text-primary");
    expect(cn("text-meta text-muted-foreground")).toBe("text-meta text-muted-foreground");
  });

  it("lets a later size replace an earlier size", () => {
    expect(cn("text-sm", "text-h1")).toBe("text-h1");
    expect(cn("text-h1", "text-title")).toBe("text-title");
  });

  it("keeps a caption-token size next to a weight and a color", () => {
    const merged = cn(
      "font-medium",
      "text-[length:var(--type-caption)]",
      "text-accent-strong",
    );
    expect(merged).toContain("text-[length:var(--type-caption)]");
    expect(merged).toContain("font-medium");
    expect(merged).toContain("text-accent-strong");
  });
});
