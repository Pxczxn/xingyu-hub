import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { COMMUNITY_RULES_SLUG, guideApi } from "@/api/guide/guide.api";

/*
 * Phase 2B: the ONLY wrappers for public guide pages.
 * Probe 2026-09-24: bare JSON; fields id/slug/title/body/publishedAt; no summary.
 * /rules reuses GET /api/v1/guide/community-rules — there is no /api/v1/rules.
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("guideApi", () => {
  it("lists GET /api/v1/guide with the default limit", async () => {
    mockedRequest.mockResolvedValue([]);

    await guideApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/guide?limit=50");
  });

  it("lists GET /api/v1/guide with an explicit limit query", async () => {
    mockedRequest.mockResolvedValue([]);

    await guideApi.list(1);

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/guide?limit=1");
  });

  it("reads GET /api/v1/guide/{slug}", async () => {
    mockedRequest.mockResolvedValue({
      id: "01900000-0000-7000-8000-000000000301",
      slug: "getting-started",
      title: "快速上手",
      body: "正文",
      publishedAt: "2026-09-18T20:33:57Z",
    });

    await guideApi.getBySlug("getting-started");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/guide/getting-started");
  });

  it("loads community rules via GET /api/v1/guide/community-rules", async () => {
    expect(COMMUNITY_RULES_SLUG).toBe("community-rules");
    mockedRequest.mockResolvedValue({
      id: "01900000-0000-7000-8000-000000000302",
      slug: "community-rules",
      title: "社区公约",
      body: "请尊重他人",
      publishedAt: "2026-09-18T20:33:57Z",
    });

    await guideApi.getCommunityRules();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/guide/community-rules");
    expect(mockedRequest.mock.calls[0][0]).not.toContain("/api/v1/rules");
  });
});
