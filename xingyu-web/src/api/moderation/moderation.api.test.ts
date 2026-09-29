import { describe, expect, it, vi, beforeEach } from "vitest";
import { appealsApi, reportsApi } from "./moderation.api";

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("reportsApi", () => {
  it("GETs /me/reports with NO limit parameter", async () => {
    // The controller method has no @RequestParam — adding ?limit= would be
    // inventing a parameter the server ignores.
    await reportsApi.listMine();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/reports");
  });

  it("GETs a report detail under /me/reports", async () => {
    await reportsApi.getById("r1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/reports/r1");
  });

  it("encodes a report id in the detail path", async () => {
    await reportsApi.getById("a b/c");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/reports/a%20b%2Fc");
  });

  it("POSTs a supplement to the /me path with a body field", async () => {
    await reportsApi.addSupplement("r1", "补充内容");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/reports/r1/supplements", {
      method: "POST",
      body: { body: "补充内容" },
    });
  });

  it("POSTs a NEW report to the resource root, not to /me/reports", async () => {
    // The write endpoint really is POST /api/v1/reports
    // (CommunityModerationController), unlike the reads which are /me/reports.
    await reportsApi.submit({ objectType: "ARTICLE", objectId: "a1", reason: "SPAM" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/reports", {
      method: "POST",
      body: { objectType: "ARTICLE", objectId: "a1", reason: "SPAM" },
    });
  });

  it("omits detail entirely when it is not supplied", async () => {
    await reportsApi.submit({ objectType: "MOMENT", objectId: "m1", reason: "OTHER" });
    const [, options] = mockedRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect("detail" in options.body).toBe(false);
  });
});

describe("appealsApi", () => {
  it("GETs /me/appeals with the default limit", async () => {
    await appealsApi.listMine();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/appeals?limit=20");
  });

  it("passes a custom limit through", async () => {
    await appealsApi.listMine(5);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/appeals?limit=5");
  });

  it("GETs an appeal detail under /me/appeals", async () => {
    await appealsApi.getById("ap1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/appeals/ap1");
  });

  it("POSTs a NEW appeal to the resource root, not to /me/appeals", async () => {
    await appealsApi.submit({ measureId: "meas1", detail: "理由" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/appeals", {
      method: "POST",
      body: { measureId: "meas1", detail: "理由" },
    });
  });

  it("sends caseId when only a caseId is available", async () => {
    await appealsApi.submit({ caseId: "case1", detail: "理由" });
    const [, options] = mockedRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.caseId).toBe("case1");
    expect("measureId" in options.body).toBe(false);
  });
});
