import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("galaxiesApi", () => {
  it("lists galaxies via GET /api/v1/galaxies", async () => {
    mockedRequest.mockResolvedValue([]);

    await galaxiesApi.list();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies");
  });

  it("reads a galaxy by slug", async () => {
    mockedRequest.mockResolvedValue({});

    await galaxiesApi.getBySlug("xingyu-official");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/xingyu-official");
  });

  it("reads members with the default limit of 50", async () => {
    mockedRequest.mockResolvedValue([]);

    await galaxiesApi.listMembers("xingyu-official");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/xingyu-official/members?limit=50");
  });

  it("reads content with the default limit of 20", async () => {
    mockedRequest.mockResolvedValue([]);

    await galaxiesApi.listContent("xingyu-official");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/xingyu-official/content?limit=20");
  });

  it("joins with POST /join", async () => {
    mockedRequest.mockResolvedValue({});

    await galaxiesApi.join("xingyu-official");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/xingyu-official/join", {
      method: "POST",
    });
  });

  it("applies with POST /apply and an optional message", async () => {
    mockedRequest.mockResolvedValue({});

    await galaxiesApi.apply("g", "let me in");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/g/apply", {
      method: "POST",
      body: { message: "let me in" },
    });

    mockedRequest.mockClear();
    await galaxiesApi.apply("g");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/g/apply", {
      method: "POST",
      body: {},
    });
  });

  it("encodes the slug", async () => {
    mockedRequest.mockResolvedValue({});

    await galaxiesApi.getBySlug("a/b c");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/galaxies/a%2Fb%20c");
  });
});
