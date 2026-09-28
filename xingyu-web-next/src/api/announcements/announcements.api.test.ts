import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { announcementsApi } from "@/api/announcements/announcements.api";

/*
 * Phase 2B: the ONLY wrappers for public announcements.
 * Probe 2026-09-24 (isolated test DB): bare JSON array/object, no Result envelope.
 * Default list limit matches the backend default (20). Integer query only.
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("announcementsApi", () => {
  it("lists GET /api/v1/announcements with the default limit", async () => {
    mockedRequest.mockResolvedValue([]);

    await announcementsApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/announcements?limit=20");
  });

  it("lists GET /api/v1/announcements with an explicit limit query", async () => {
    mockedRequest.mockResolvedValue([]);

    await announcementsApi.list(50);

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/announcements?limit=50");
  });

  it("reads GET /api/v1/announcements/{id}", async () => {
    mockedRequest.mockResolvedValue({
      id: "ann-1",
      title: "维护通知",
      body: "今晚维护",
      publishedAt: "2026-09-18T20:33:57Z",
    });

    await announcementsApi.getById("ann-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/announcements/ann-1");
  });
});
