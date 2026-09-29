import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { creationSpaceApi } from "./creation-space.api";

/*
 * Wire contract for the creation-space category endpoints (Phase 2N).
 *
 * These assertions are about the SHAPE of the request, because the shapes here
 * are easy to get subtly wrong and the failure is quiet:
 *   - update is PATCH (a PUT would 405);
 *   - `lockVersion` must survive into the body (omitting it reads as 0
 *     server-side and turns every update into a spurious 409);
 *   - ids are encodeURIComponent'd.
 */

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(async () => undefined),
}));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockClear();
});

describe("creationSpaceApi", () => {
  it("lists categories from /me/creation-space/categories", async () => {
    await creationSpaceApi.listCategories();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories");
  });

  it("creates a category with POST", async () => {
    await creationSpaceApi.createCategory({ name: "散文", slug: "essay" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories", {
      method: "POST",
      body: { name: "散文", slug: "essay" },
    });
  });

  it("omits slug when it was not supplied", async () => {
    await creationSpaceApi.createCategory({ name: "散文" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories", {
      method: "POST",
      body: { name: "散文" },
    });
  });

  it("updates with PATCH and carries lockVersion into the body", async () => {
    await creationSpaceApi.updateCategory("c1", { lockVersion: 3, name: "新名" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories/c1", {
      method: "PATCH",
      body: { lockVersion: 3, name: "新名" },
    });
  });

  it("sends lockVersion even when nothing else changes (archive)", async () => {
    await creationSpaceApi.updateCategory("c1", { lockVersion: 7, status: "ARCHIVED" });
    const [, options] = mockedRequest.mock.calls[0] as [string, { body: unknown }];
    expect(options.body).toEqual({ lockVersion: 7, status: "ARCHIVED" });
    // The version must be an explicit number, never dropped.
    expect((options.body as { lockVersion?: unknown }).lockVersion).toBe(7);
  });

  it("deletes with DELETE", async () => {
    await creationSpaceApi.deleteCategory("c1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories/c1", {
      method: "DELETE",
    });
  });

  it("encodes the category id", async () => {
    await creationSpaceApi.deleteCategory("a/b c");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/creation-space/categories/a%2Fb%20c", {
      method: "DELETE",
    });
  });

  it("keeps lockVersion 0 distinct from an absent one", async () => {
    // A freshly-created category has lockVersion 0; sending it must not be
    // mistaken for "no version supplied".
    await creationSpaceApi.updateCategory("c1", { lockVersion: 0, status: "ARCHIVED" });
    const [, options] = mockedRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect("lockVersion" in options.body).toBe(true);
    expect(options.body.lockVersion).toBe(0);
  });
});
