import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  READING_HISTORY_DEFAULT_LIMIT,
  READING_HISTORY_MAX_LIMIT,
  readingHistoryApi,
} from "./reading-history.api";

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
});

describe("readingHistoryApi.list", () => {
  it("GETs /api/v1/me/reading-history with the server's default limit", async () => {
    await readingHistoryApi.list();
    expect(mockedRequest).toHaveBeenCalledWith(
      `/api/v1/me/reading-history?limit=${READING_HISTORY_DEFAULT_LIMIT}`,
    );
  });

  it("passes a larger limit through — the only way to widen the read", async () => {
    await readingHistoryApi.list(READING_HISTORY_MAX_LIMIT);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/reading-history?limit=100");
  });

  it("issues a GET — no method override", async () => {
    await readingHistoryApi.list();
    const [, options] = mockedRequest.mock.calls[0] as [string, unknown];
    expect(options).toBeUndefined();
  });

  it("never sends a cursor, because the server ignores one", async () => {
    // `ReadingService.readingHistory` discards the cursor param and always
    // returns nextCursor: null. Sending one would imply a paging contract that
    // does not exist.
    await readingHistoryApi.list();
    const [url] = mockedRequest.mock.calls[0] as [string];
    expect(url).not.toContain("cursor");
  });

  it("hits reading-history, NOT the non-existent /me/history", async () => {
    // The two paths look alike; only one exists. /me/history 500s.
    await readingHistoryApi.list();
    const [url] = mockedRequest.mock.calls[0] as [string];
    expect(url).toContain("/me/reading-history");
    expect(url).not.toMatch(/\/me\/history(\?|$)/);
  });
});

describe("readingHistoryApi surface", () => {
  it("exposes no progress writer", () => {
    // POST /me/reading-progress belongs to the reading surfaces, not to a
    // history page — a writer here would invite a page to fabricate history.
    expect(Object.keys(readingHistoryApi)).toEqual(["list"]);
  });
});
