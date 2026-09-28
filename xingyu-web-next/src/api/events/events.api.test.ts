import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventsApi } from "./events.api";
import { apiRequest } from "@/api/client";

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const mocked = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("eventsApi reads", () => {
  it("reads the event list as a BARE ARRAY with the default limit", async () => {
    const rows = [{ id: "e1", slug: "s", title: "活动", submissionOpen: true }];
    mocked.mockResolvedValue(rows);

    await expect(eventsApi.list()).resolves.toEqual(rows);
    expect(mocked).toHaveBeenCalledWith("/api/v1/events?limit=20");
  });

  it("passes an explicit limit through", async () => {
    mocked.mockResolvedValue([]);
    await eventsApi.list(5);
    expect(mocked).toHaveBeenCalledWith("/api/v1/events?limit=5");
  });

  it("reads one event by id, encoded", async () => {
    mocked.mockResolvedValue({ id: "a/b", slug: "s", title: "t", submissionOpen: true });
    await eventsApi.get("a/b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/events/a%2Fb");
  });

  it("reads the public submission list with its own default of 50", async () => {
    // Its default differs from the event list's 20 — pinned so a future
    // "share the constant" refactor cannot silently change the page size.
    mocked.mockResolvedValue([]);
    await eventsApi.listAcceptedSubmissions("e1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/events/e1/submissions?limit=50");
  });

  it("reads MY submissions from the /me path, not the public one", async () => {
    // These two are one word apart and return different sets: the public list is
    // ACCEPTED-only, this one is everything the caller sent.
    mocked.mockResolvedValue([]);
    await eventsApi.listMySubmissions();
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/event-submissions?limit=100");
  });

  it("never issues a write on the read paths", async () => {
    mocked.mockResolvedValue([]);
    await eventsApi.list();
    await eventsApi.listAcceptedSubmissions("e1");
    await eventsApi.listMySubmissions();
    for (const call of mocked.mock.calls) {
      expect(call[1]?.method ?? "GET").toBe("GET");
    }
  });
});

describe("eventsApi registration", () => {
  it("POSTs to the register path", async () => {
    mocked.mockResolvedValue({ id: "r1", eventId: "e1", status: "REGISTERED" });
    const result = await eventsApi.register("e1");

    expect(mocked).toHaveBeenCalledWith("/api/v1/me/events/e1/register", { method: "POST" });
    expect(result.status).toBe("REGISTERED");
  });

  it("DELETEs the same path to cancel", async () => {
    mocked.mockResolvedValue(undefined);
    await eventsApi.cancelRegistration("e1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/events/e1/register", { method: "DELETE" });
  });

  it("encodes the event id in both directions", async () => {
    mocked.mockResolvedValue({ id: "r", eventId: "a/b", status: "REGISTERED" });
    await eventsApi.register("a/b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/events/a%2Fb/register", { method: "POST" });

    mocked.mockResolvedValue(undefined);
    await eventsApi.cancelRegistration("a/b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/events/a%2Fb/register", { method: "DELETE" });
  });
});

describe("eventsApi.submit", () => {
  it("POSTs the object reference and the note", async () => {
    mocked.mockResolvedValue({ id: "s1", eventId: "e1", objectType: "ARTICLE", objectId: "a1" });

    await eventsApi.submit("e1", { objectType: "ARTICLE", objectId: "a1", note: "我的投稿" });

    expect(mocked).toHaveBeenCalledWith("/api/v1/me/events/e1/submissions", {
      method: "POST",
      body: { objectType: "ARTICLE", objectId: "a1", note: "我的投稿" },
    });
  });

  it("omits the note when there is none, rather than sending an empty string", async () => {
    mocked.mockResolvedValue({ id: "s1", eventId: "e1", objectType: "SERIES", objectId: "s1" });

    await eventsApi.submit("e1", { objectType: "SERIES", objectId: "s1" });

    const body = mocked.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).toEqual({ objectType: "SERIES", objectId: "s1" });
    expect("note" in body).toBe(false);
  });

  it("sends the objectType verbatim, uppercase", async () => {
    // The server looks the object up with (type, id) as given; a lowercase
    // "article" would miss search_document and 404.
    mocked.mockResolvedValue({ id: "s1", eventId: "e1", objectType: "MOMENT", objectId: "m1" });

    await eventsApi.submit("e1", { objectType: "MOMENT", objectId: "m1" });

    expect(mocked.mock.calls[0][1]?.body).toMatchObject({ objectType: "MOMENT" });
  });
});

describe("eventsApi surface", () => {
  it("exposes exactly the reads, the two registration calls and submit", () => {
    // Group administration (create/update/review) is deliberately absent — that
    // is admin-only surface, and this assertion keeps it out of the web client.
    expect(Object.keys(eventsApi)).toEqual([
      "list",
      "get",
      "listAcceptedSubmissions",
      "listMySubmissions",
      "register",
      "cancelRegistration",
      "submit",
    ]);
  });
});
