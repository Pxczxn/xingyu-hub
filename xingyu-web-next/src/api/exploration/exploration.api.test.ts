import { beforeEach, describe, expect, it, vi } from "vitest";
import { explorationApi } from "./exploration.api";

/*
 * Surface + wire-shape tests for the exploration API.
 *
 * `apiRequest` is mocked (the house pattern) so these pin the REQUEST SHAPE and
 * the SURFACE — not transport behaviour. The `/explore/me` guest-500 is a
 * BACKEND bug; the API layer must PROPAGATE it rather than invent an empty
 * fallback, which the last test guards.
 */

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("explorationApi surface", () => {
  it("exposes exactly the three read/write methods for this phase", () => {
    expect(Object.keys(explorationApi).sort()).toEqual(["getMap", "getMine", "updateMine"]);
  });

  it("does NOT expose the domain-application write (out of scope for /me/interests)", () => {
    // POST /explore/domain-applications is real, but this page is about the
    // caller's own interests, not proposing a new official domain.
    expect("applyDomain" in explorationApi).toBe(false);
    expect("applyExploreDomain" in explorationApi).toBe(false);
  });
});

describe("explorationApi.getMap", () => {
  it("GETs /api/v1/explore/map with no options object", async () => {
    await explorationApi.getMap();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/explore/map");
    const [url, options] = mockedRequest.mock.calls[0] as [string, unknown];
    expect(url).toBe("/api/v1/explore/map");
    // Public endpoint, no parameters — no method override, no query string.
    expect(url).not.toContain("?");
    expect(options).toBeUndefined();
  });

  it("returns the parsed domain array unchanged", async () => {
    mockedRequest.mockResolvedValue([{ id: "r", slug: "tech", name: "技术", children: [] }]);
    const map = await explorationApi.getMap();
    expect(map).toHaveLength(1);
    expect(map[0].name).toBe("技术");
  });
});

describe("explorationApi.getMine", () => {
  it("GETs /api/v1/explore/me", async () => {
    mockedRequest.mockResolvedValue({ domains: [], customLabels: [] });
    await explorationApi.getMine();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/explore/me");
  });

  it("returns both domains and customLabels", async () => {
    mockedRequest.mockResolvedValue({
      domains: [{ id: "a", slug: "a", name: "A", personal: false }],
      customLabels: ["Java"],
    });
    const mine = await explorationApi.getMine();
    expect(mine.domains[0].id).toBe("a");
    expect(mine.customLabels).toEqual(["Java"]);
  });

  it("PROPAGATES a failure — no invented empty fallback that would hide the 500", async () => {
    mockedRequest.mockRejectedValue(new Error("系统繁忙，请稍后再试"));
    await expect(explorationApi.getMine()).rejects.toThrow("系统繁忙");
  });
});

describe("explorationApi.updateMine", () => {
  it("PUTs the FULL desired state (not a delta) as the body", async () => {
    await explorationApi.updateMine({ domainIds: ["a", "b"], customLabels: ["Java"] });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/explore/me", {
      method: "PUT",
      body: { domainIds: ["a", "b"], customLabels: ["Java"] },
    });
  });

  it("sends explicit empty arrays when clearing everything", async () => {
    await explorationApi.updateMine({ domainIds: [], customLabels: [] });
    const [, options] = mockedRequest.mock.calls[0] as [string, { body: unknown }];
    // Full replacement: the empty arrays must be PRESENT so the destructive
    // intent is explicit rather than implied by omission.
    expect(options.body).toEqual({ domainIds: [], customLabels: [] });
  });

  it("forwards the write's own response unchanged", async () => {
    mockedRequest.mockResolvedValue({
      domains: [{ id: "a", slug: "a", name: "A", personal: false }],
      customLabels: ["Rust"],
    });
    const next = await explorationApi.updateMine({ domainIds: ["a"], customLabels: ["Rust"] });
    expect(next.customLabels).toEqual(["Rust"]);
    expect(next.domains[0].id).toBe("a");
  });
});
