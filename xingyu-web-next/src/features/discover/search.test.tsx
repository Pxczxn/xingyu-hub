import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import { SearchPage } from "./pages/SearchPage";

/*
 * Search tests (Phase 1A): the keyword must come from the URL (?q=),
 * and empty / loading / error / results states must be handled.
 */

vi.mock("@/api/discover/discover.api", () => ({
  discoverApi: {
    search: vi.fn(),
    getDiscoverNav: vi.fn(),
    getExploreFeed: vi.fn(),
    getDiscover: vi.fn(),
  },
}));

const mocked = vi.mocked(discoverApi);

const HITS = [
  {
    objectType: "ARTICLE",
    objectId: "a1",
    title: "Spring 实战笔记",
    summary: "关于 Spring 的一些实践",
  },
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SearchPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.search.mockResolvedValue({ items: [], total: 0, nextCursor: null });
});

describe("search page", () => {
  it("reads the keyword from the URL and issues the query", async () => {
    mocked.search.mockResolvedValue({
      items: HITS.map((h) => ({ id: h.objectId, title: h.title, summary: h.summary, objectType: h.objectType })),
      total: 1,
    });

    renderAt("/search?q=spring");

    await waitFor(() => {
      expect(mocked.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: "spring" }),
      );
    });
    expect(await screen.findByText("Spring 实战笔记")).toBeInTheDocument();
  });

  it("does not query the API when the query is empty", () => {
    renderAt("/search");
    expect(mocked.search).not.toHaveBeenCalled();
    expect(screen.getByText("暂无内容")).toBeInTheDocument();
  });

  it("shows an empty-result state when nothing matches", async () => {
    mocked.search.mockResolvedValue({ items: [], total: 0 });

    renderAt("/search?q=nothing");

    await waitFor(() => {
      expect(screen.getByTestId("search-no-results")).toBeInTheDocument();
    });
    expect(screen.getByTestId("search-no-results")).toHaveTextContent("nothing");
  });

  it("shows an error state when the search request fails", async () => {
    mocked.search.mockRejectedValue(new Error("boom"));

    renderAt("/search?q=spring");

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
  });
});
