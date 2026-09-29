import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import { ApiError } from "@/api/client";
import { GuideIndexPage } from "./pages/GuideIndexPage";
import { GuideDetailPage } from "./pages/GuideDetailPage";

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: { list: vi.fn(), getBySlug: vi.fn(), getCommunityRules: vi.fn() },
}));

const mocked = vi.mocked(guideApi);

const PAGE = {
  id: "g1",
  slug: "getting-started",
  title: "快速上手",
  body: "星语社区是一个以阅读与创作为核心的内容社区。",
  publishedAt: "2026-09-18T20:33:57Z",
};

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={["/guide"]}>
      <Routes>
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/guide/${slug}`]}>
      <Routes>
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GuideIndexPage", () => {
  it("shows loading while the catalog request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderIndex();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows empty when the catalog is an empty array", async () => {
    mocked.list.mockResolvedValue([]);
    renderIndex();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });

  it("renders titles without a summary and opens the slug page", async () => {
    mocked.list.mockResolvedValue([PAGE]);
    mocked.getBySlug.mockResolvedValue(PAGE);
    renderIndex();

    const link = await screen.findByRole("link", { name: "快速上手" });
    expect(link).toHaveAttribute("href", "/guide/getting-started");
    expect(screen.queryByText("查看该指南的完整说明。")).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(await screen.findByText(PAGE.body)).toBeInTheDocument();
  });

  it("shows an error state when the catalog fails", async () => {
    mocked.list.mockRejectedValue(notFound());
    renderIndex();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

describe("GuideDetailPage", () => {
  it("renders the body as plain text and links back to the catalog", async () => {
    mocked.getBySlug.mockResolvedValue(PAGE);
    renderDetail("getting-started");
    expect(await screen.findByRole("heading", { name: "快速上手" })).toBeInTheDocument();
    expect(screen.getByText(PAGE.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回指南目录" })).toHaveAttribute("href", "/guide");
    expect(screen.queryByRole("link", { name: /联系支持/ })).not.toBeInTheDocument();
  });

  it("shows a missing-guide state for 404", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());
    renderDetail("__missing__");
    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
  });

  it("uses the router param as-is and does not double-decode the slug", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());
    // One URL decode of %2520 is "%20". A second decodeURIComponent would yield a space.
    renderDetail("foo%2520bar");

    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
    expect(mocked.getBySlug).toHaveBeenCalledWith("foo%20bar");
    expect(mocked.getBySlug).not.toHaveBeenCalledWith("foo bar");
  });

  it("does not throw when the slug contains a malformed percent sequence", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());

    expect(() => renderDetail("%E0%A4%A")).not.toThrow();
    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
  });
});
