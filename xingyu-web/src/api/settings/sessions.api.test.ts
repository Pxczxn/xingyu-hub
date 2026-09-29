import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { sessionsApi } from "@/api/settings/sessions.api";
import type { SessionSummary } from "@/api/settings/sessions.types";

/*
 * The sessions API layer carries two behaviours that the page relies on:
 * dropping already-revoked rows and ordering current-first. Both were verified
 * necessary against the live backend — GET /me/sessions keeps returning revoked
 * rows (it does not delete them), and it makes no ordering guarantee.
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "s1",
    deviceLabel: "浏览器",
    lastActiveAt: "2026-09-22T10:00:00Z",
    expiresAt: "2026-09-23T10:00:00Z",
    revoked: false,
    current: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("sessionsApi.list", () => {
  it("drops revoked sessions", async () => {
    mockedRequest.mockResolvedValue([
      session({ sessionId: "a", revoked: true }),
      session({ sessionId: "b" }),
    ]);

    const result = await sessionsApi.list();

    expect(result.map((s) => s.sessionId)).toEqual(["b"]);
  });

  it("puts the current session first regardless of activity time", async () => {
    mockedRequest.mockResolvedValue([
      session({ sessionId: "recent", lastActiveAt: "2026-09-22T12:00:00Z" }),
      session({ sessionId: "mine", current: true, lastActiveAt: "2026-09-20T01:00:00Z" }),
    ]);

    const result = await sessionsApi.list();

    expect(result.map((s) => s.sessionId)).toEqual(["mine", "recent"]);
  });

  it("orders the remaining sessions by most recent activity", async () => {
    mockedRequest.mockResolvedValue([
      session({ sessionId: "old", lastActiveAt: "2026-09-01T00:00:00Z" }),
      session({ sessionId: "new", lastActiveAt: "2026-09-22T00:00:00Z" }),
      session({ sessionId: "mid", lastActiveAt: "2026-09-10T00:00:00Z" }),
    ]);

    const result = await sessionsApi.list();

    expect(result.map((s) => s.sessionId)).toEqual(["new", "mid", "old"]);
  });

  it("tolerates a null payload", async () => {
    mockedRequest.mockResolvedValue(null as unknown as SessionSummary[]);

    await expect(sessionsApi.list()).resolves.toEqual([]);
  });

  it("calls the documented endpoint", async () => {
    mockedRequest.mockResolvedValue([]);

    await sessionsApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/sessions");
  });
});

describe("sessionsApi mutations", () => {
  it("revokes by id via DELETE", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await sessionsApi.revoke("s-123");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/sessions/s-123", { method: "DELETE" });
  });

  it("encodes the session id", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await sessionsApi.revoke("a/b");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/sessions/a%2Fb", { method: "DELETE" });
  });

  it("revokes the other sessions via POST", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await sessionsApi.revokeOthers();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/sessions/revoke-others", {
      method: "POST",
    });
  });
});
