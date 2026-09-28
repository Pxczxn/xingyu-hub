import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import { DiscoverPage } from "./pages/DiscoverPage";

/*
 * Regression tests for the /discover live-acceptance fix.
 * /api/v1/explore/feed returns 500 INTERNAL_ERROR on the real backend, so the
 * page must use the working /api/v1/discover endpoint instead.
 */

vi.mock("@/api/discover/discover.api", () => ({
  discoverApi: {
    getDiscover: vi.fn(),
    getDiscoverNav: vi.fn(),
    search: vi.fn(),
  },
}));

const mocked = vi.mocked(discoverApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getDiscoverNav.mockResolvedValue({ mode: "guest", sectionTitle: "热门星域", feedHint: "提示语" });
});

describe("discover page", () => {
  it("loads content via /api/v1/discover and renders it", async () => {
    mocked.getDiscover.mockResolvedValue({
      items: [{ id: "c1", title: "真实发现内容", objectType: "ARTICLE" }],
      total: 1,
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => expect(mocked.getDiscover).toHaveBeenCalled());
    expect(await screen.findByText("真实发现内容")).toBeInTheDocument();
    expect(screen.getByTestId("discover-results")).toBeInTheDocument();
  });

  it("uses the backend section copy for the heading", async () => {
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    expect(await screen.findByRole("heading", { name: "热门星域" })).toBeInTheDocument();
  });

  it("shows an error state when the discover request fails", async () => {
    mocked.getDiscover.mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() => expect(screen.getByTestId("page-state-error")).toBeInTheDocument());
    expect(screen.queryByTestId("discover-results")).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no content", async () => {
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("page-state-empty")).toBeInTheDocument());
  });
});
