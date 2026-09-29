import { beforeEach, describe, expect, it, vi } from "vitest";
import { badgesApi } from "./badges.api";

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("badgesApi", () => {
  it("GETs /api/v1/me/badges", async () => {
    await badgesApi.list();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/badges");
  });

  it("issues a GET — no method override and no query string", async () => {
    await badgesApi.list();
    const [url, options] = mockedRequest.mock.calls[0] as [string, unknown];
    expect(url).toBe("/api/v1/me/badges");
    // No cursor/limit surface: the endpoint takes no parameters.
    expect(url).not.toContain("?");
    expect(options).toBeUndefined();
  });

  it("returns the payload unchanged (bare array, no unwrapping)", async () => {
    mockedRequest.mockResolvedValue([
      { id: "onboard", title: "入门完成", description: "完成入门引导", earned: true },
    ]);
    const result = await badgesApi.list();
    expect(result).toHaveLength(1);
    expect(result[0].earned).toBe(true);
  });
});
