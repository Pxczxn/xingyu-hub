import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { apiTokensApi } from "@/api/settings/api-tokens.api";

/*
 * Phase 2A-2b API-token endpoints. These are the ONLY wrappers for
 * `/me/api-tokens` (one wrapper per endpoint), so the exact method + path
 * contract is pinned here:
 *   GET    /api/v1/me/api-tokens?limit=20
 *   POST   /api/v1/me/api-tokens
 *   DELETE /api/v1/me/api-tokens/{tokenId}
 *
 * The `persistToken: false` on create is a SECURITY contract, not a style
 * choice: the create response's `token` field is the API secret, and without
 * the opt-out the transport would store it as the login token (see
 * src/api/client.test.ts for the behavioural proof).
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("apiTokensApi", () => {
  it("lists tokens from GET /me/api-tokens with the default limit", async () => {
    mockedRequest.mockResolvedValue([]);

    await apiTokensApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/api-tokens?limit=20");
  });

  it("passes an explicit limit (the backend has no cursor)", async () => {
    mockedRequest.mockResolvedValue([]);

    await apiTokensApi.list(50);

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/api-tokens?limit=50");
  });

  it("creates a token via POST and opts out of session-token persistence", async () => {
    mockedRequest.mockResolvedValue({ id: "t-1", name: "CI", token: "xy_secret", scopes: [] });

    await apiTokensApi.create("CI");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/api-tokens", {
      method: "POST",
      body: { name: "CI" },
      persistToken: false,
    });
  });

  it("sends no scopes so the backend applies its default set", async () => {
    mockedRequest.mockResolvedValue({ id: "t-1", name: "CI", token: "xy_secret", scopes: [] });

    await apiTokensApi.create("CI");

    const [, options] = mockedRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).toEqual({ name: "CI" });
    expect("scopes" in options.body).toBe(false);
  });

  it("revokes a token via DELETE", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await apiTokensApi.revoke("t-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/api-tokens/t-1", { method: "DELETE" });
  });

  it("encodes the token id in the path", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await apiTokensApi.revoke("a/b");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/api-tokens/a%2Fb", { method: "DELETE" });
  });
});
