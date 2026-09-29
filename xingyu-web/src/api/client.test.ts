import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/api/client";
import { getStoredToken, setStoredToken, TOKEN_KEY } from "@/lib/storage";

/**
 * API client transport tests (migrated from Legacy lib/api-client.test.ts).
 * Verifies the sa-token contract is preserved end-to-end.
 */

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("sends the stored token in the satoken header", async () => {
    setStoredToken("stored-token-value");
    await apiRequest("/api/v1/me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.satoken).toBe("stored-token-value");
  });

  it("omits the satoken header when no token is stored", async () => {
    await apiRequest("/api/v1/me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.satoken).toBeUndefined();
  });

  it("persists a satoken returned in the response header", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ email: "a@b.c" }, { headers: { satoken: "header-token" } }),
    );

    await apiRequest("/api/v1/auth/login", { method: "POST", body: {} });

    expect(localStorage.getItem(TOKEN_KEY)).toBe("header-token");
    expect(getStoredToken()).toBe("header-token");
  });

  it("persists a token returned in the response body", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ token: "body-token" }));

    await apiRequest("/api/v1/auth/login", { method: "POST", body: {} });

    expect(getStoredToken()).toBe("body-token");
  });

  /*
   * Phase 2A-2b regression: `POST /me/api-tokens` answers with `{ ..., token }`
   * where `token` is the API SECRET, not a session token. Without the opt-out
   * the client would write it to `xingyu-satoken`, replacing the session (and
   * the next 401 would log the user out).
   */
  it("does not touch the session when persistToken is false", async () => {
    setStoredToken("real-session-token");
    fetchMock.mockImplementation(async () =>
      jsonResponse({ id: "t-1", name: "CI", token: "xy_api_secret_value", scopes: [] }),
    );

    const created = await apiRequest<{ token: string }>("/api/v1/me/api-tokens", {
      method: "POST",
      body: { name: "CI" },
      persistToken: false,
    });

    // The secret still reaches the caller...
    expect(created.token).toBe("xy_api_secret_value");
    // ...but the login session is untouched.
    expect(localStorage.getItem(TOKEN_KEY)).toBe("real-session-token");
    expect(getStoredToken()).toBe("real-session-token");
  });

  it("still persists the session token when persistToken is omitted (auth endpoints)", async () => {
    setStoredToken("old-session");
    fetchMock.mockImplementation(async () => jsonResponse({ token: "new-session" }));

    await apiRequest("/api/v1/auth/login", { method: "POST", body: {} });

    expect(getStoredToken()).toBe("new-session");
  });

  it("clears the stored token when the API responds 401", async () => {
    setStoredToken("expired-token");
    fetchMock.mockImplementation(async () =>
      jsonResponse({ status: 401, code: "UNAUTHORIZED", detail: "expired" }, { status: 401 }),
    );

    await expect(apiRequest("/api/v1/me")).rejects.toThrow(ApiError);
    expect(getStoredToken()).toBeNull();
  });

  it("throws ApiError carrying the backend problem details", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "invalid payload",
          code: "VALIDATION_FAILED",
        },
        { status: 400 },
      ),
    );

    await expect(apiRequest("/api/v1/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      name: "ApiError",
      problem: { status: 400, code: "VALIDATION_FAILED", detail: "invalid payload" },
    });
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(null, { status: 204 }));
    await expect(apiRequest("/api/v1/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });
});
