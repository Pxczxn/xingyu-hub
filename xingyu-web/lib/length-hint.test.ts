import { describe, expect, it } from "vitest";
import { formatLengthHint, getLengthHintStatus, lengthHintClassName } from "@/lib/length-hint";

describe("length hint helpers", () => {
  it("formats current and max length", () => {
    expect(formatLengthHint(5, 32)).toBe("5/32");
  });

  it("uses neutral style for count-only hint", () => {
    expect(lengthHintClassName("neutral")).toBe("text-zinc-400");
  });

  it("marks valid length as pass", () => {
    expect(getLengthHintStatus(6, 6, 20)).toBe("pass");
    expect(getLengthHintStatus(3, 3, 32)).toBe("pass");
  });

  it("marks invalid length as fail", () => {
    expect(getLengthHintStatus(2, 3, 32)).toBe("fail");
    expect(getLengthHintStatus(21, 6, 20)).toBe("fail");
  });
});
