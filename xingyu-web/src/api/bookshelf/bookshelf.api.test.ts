import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import type { BookshelfPage } from "@/api/bookshelf/bookshelf.types";

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("bookshelfApi", () => {
  it("lists GET /api/v1/me/bookshelf with no query by default", async () => {
    mockedRequest.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    await bookshelfApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/bookshelf");
  });

  it("sends limit and cursor query params", async () => {
    mockedRequest.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    await bookshelfApi.list({ limit: 1, cursor: "abc" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/bookshelf?limit=1&cursor=abc");
  });

  it("types PageResult without hasMore", async () => {
    const page: BookshelfPage = { items: [], nextCursor: null, total: 0 };
    mockedRequest.mockResolvedValue(page);

    const result = await bookshelfApi.list();

    expect(result).toEqual({ items: [], nextCursor: null, total: 0 });
    expect(Object.prototype.hasOwnProperty.call(result, "hasMore")).toBe(false);
  });
});
