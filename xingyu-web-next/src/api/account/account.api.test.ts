import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountApi } from "./account.api";

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const { apiRequest } = await import("@/api/client");
const mocked = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.mockResolvedValue(undefined as never);
});

describe("accountApi.reAuthenticate", () => {
  it("POSTs the password to the auth endpoint", async () => {
    mocked.mockResolvedValue({ recentAuthId: "ra-1", expiresAt: "2026-09-28T10:15:00Z" } as never);
    const grant = await accountApi.reAuthenticate("secret");
    expect(mocked).toHaveBeenCalledWith("/api/v1/auth/re-authenticate", {
      method: "POST",
      body: { password: "secret" },
      persistToken: false,
    });
    expect(grant.recentAuthId).toBe("ra-1");
  });

  it("never persists a token from this response", async () => {
    await accountApi.reAuthenticate("secret");
    const options = mocked.mock.calls[0][1] as { persistToken?: boolean };
    // Guards against a future response field named `token` clobbering the session.
    expect(options.persistToken).toBe(false);
  });
});

describe("accountApi.changeEmail", () => {
  it("sends the new email and password with the recent-auth header", async () => {
    mocked.mockResolvedValue({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: true,
    } as never);
    const result = await accountApi.changeEmail(
      { newEmail: "new@pxczxn.top", password: "pw" },
      "ra-1",
    );
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/email/change", {
      method: "POST",
      body: { newEmail: "new@pxczxn.top", password: "pw" },
      headers: { "X-Recent-Auth": "ra-1" },
      persistToken: false,
    });
    expect(result.mailPending).toBe(true);
  });

  it("omits the header entirely when no grant is supplied", async () => {
    // Passing `{ "X-Recent-Auth": undefined }` would be a different request shape;
    // the backend needs the header ABSENT so it answers its own 403.
    await accountApi.changeEmail({ newEmail: "new@pxczxn.top", password: "pw" });
    const options = mocked.mock.calls[0][1] as { headers?: unknown };
    expect(options.headers).toBeUndefined();
  });
});

describe("accountApi.getDataExport", () => {
  it("GETs the export and returns the payload", async () => {
    mocked.mockResolvedValue({ exportedAt: "2026-09-28T10:00:00Z", articles: [] } as never);
    const payload = await accountApi.getDataExport();
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/data-export", { persistToken: false });
    expect(payload.exportedAt).toBe("2026-09-28T10:00:00Z");
  });
});

describe("accountApi.requestAccountDeletion", () => {
  it("POSTs the request and normalises the 204 into a result object", async () => {
    await accountApi.requestAccountDeletion();
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/account/deletion-request", {
      method: "POST",
      persistToken: false,
    });
  });

  it("returns { requested: true } so a caller cannot read 204 as 'nothing happened'", async () => {
    // apiRequest<void> resolves to undefined on 204; swallowing that into an
    // explicit flag keeps the happy path assertable.
    await expect(accountApi.requestAccountDeletion()).resolves.toEqual({ requested: true });
  });
});

describe("account API surface", () => {
  it("exposes exactly the four verified operations and no phantom writes", () => {
    // Absence guard: the backend has NO cancel-deletion, NO set-password, and NO
    // email-verify-confirm endpoint under these paths. Adding one here before the
    // backend exists would produce a control that can only fail.
    expect(Object.keys(accountApi).sort()).toEqual([
      "changeEmail",
      "getDataExport",
      "reAuthenticate",
      "requestAccountDeletion",
    ]);
  });
});
