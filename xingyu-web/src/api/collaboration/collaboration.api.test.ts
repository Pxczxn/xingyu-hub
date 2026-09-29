import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { collaborationApi } from "./collaboration.api";

/*
 * Collaboration invite API (Phase 2M).
 *
 * These tests pin the CONTRACT SHAPE, which is unusually loose here (a Map built
 * with Map.of, so keys can vanish), plus the read/write path split.
 */

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createInvite", () => {
  it("POSTs to the /me family, not the /collaboration root", async () => {
    // Creating lives on /me/*; resolve/accept live on /collaboration/*.
    // Probing the wrong side returns 405 and looks like a missing feature.
    apiRequestMock.mockResolvedValue({});

    await collaborationApi.createInvite("一起审稿");

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/collaboration-invites", {
      method: "POST",
      body: { note: "一起审稿" },
    });
  });

  it("passes an undefined note straight through", async () => {
    apiRequestMock.mockResolvedValue({});

    await collaborationApi.createInvite();

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/collaboration-invites", {
      method: "POST",
      body: { note: undefined },
    });
  });

  it("returns the invite, including the RELATIVE inviteUrl", async () => {
    const invite = {
      id: "i1",
      token: "abc123",
      inviteUrl: "/studio/collaboration/accept?token=abc123",
      note: "一起来",
      expiresAt: "2026-10-05T00:00:00Z",
    };
    apiRequestMock.mockResolvedValue(invite);

    await expect(collaborationApi.createInvite("一起来")).resolves.toEqual(invite);
  });
});

describe("resolveInvite", () => {
  it("GETs the public resolve endpoint with the token query-encoded", async () => {
    apiRequestMock.mockResolvedValue({ valid: true });

    await collaborationApi.resolveInvite("a b/c");

    // A GET carries no options object — assert the single-argument form.
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/v1/collaboration/invites/resolve?token=a%20b%2Fc",
    );
  });

  it("passes through the invalid branch, which has ONLY the valid key", async () => {
    // Map.of cannot hold nulls, so the invalid branch is literally {valid:false}.
    // Anything expecting inviterUsername here would break in production.
    apiRequestMock.mockResolvedValue({ valid: false });

    await expect(collaborationApi.resolveInvite("nope")).resolves.toEqual({ valid: false });
  });

  it("tolerates a valid response missing the optional inviter fields", async () => {
    apiRequestMock.mockResolvedValue({ valid: true, note: "" });

    const result = await collaborationApi.resolveInvite("t");
    expect(result.valid).toBe(true);
    expect(result.inviterUsername).toBeUndefined();
  });
});

describe("acceptInvite", () => {
  it("POSTs the token in the body", async () => {
    apiRequestMock.mockResolvedValue({ accepted: true });

    await collaborationApi.acceptInvite("tok");

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/collaboration/invites/accept", {
      method: "POST",
      body: { token: "tok" },
    });
  });

  it("surfaces a rejection rather than inventing success", async () => {
    const failure = Object.assign(new Error("邀请已失效或不存在"), {
      name: "ApiError",
      problem: {
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "邀请已失效或不存在",
        code: "NOT_FOUND",
      },
    });
    apiRequestMock.mockRejectedValue(failure);

    await expect(collaborationApi.acceptInvite("bad")).rejects.toBe(failure);
  });

  it("does not fabricate any relationship in its return value", async () => {
    // The backend returns no resource id / membership, because none is created.
    // If this ever gains a field, the UI copy about "no permissions granted"
    // must be revisited — which is exactly why the shape is asserted here.
    apiRequestMock.mockResolvedValue({
      accepted: true,
      inviterUsername: "alice",
      inviterDisplayName: "爱丽丝",
      note: "hi",
    });

    const result = await collaborationApi.acceptInvite("tok");
    expect(Object.keys(result).sort()).toEqual([
      "accepted",
      "inviterDisplayName",
      "inviterUsername",
      "note",
    ]);
  });
});
