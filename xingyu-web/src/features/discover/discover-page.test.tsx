import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
import type { ContentSummary } from "@/api/common.types";
import { AuthProvider } from "@/features/auth/auth.store";
import { DiscoverPage } from "./pages/DiscoverPage";

/*
 * Page-level contracts for /discover.
 *
 * The page is a sidebar of real filters plus the server's feed rendered as a
 * single reading list, in the order the server returned it. Interaction details
 * (switching filters, pagination, stale responses) belong to
 * discover-filters.test.tsx; this file keeps the page honest about loading,
 * topics, feed order and the loading / empty / error states.
 */

vi.mock("@/api/discover/discover.api", () => ({ discoverApi: { getDiscover: vi.fn() } }));
vi.mock("@/api/topics/topics.api", () => ({ topicsApi: { getTopics: vi.fn() } }));

const discover = vi.mocked(discoverApi.getDiscover);
const topics = vi.mocked(topicsApi.getTopics);

const article = (
  id: string,
  title: string,
  extra: Partial<ContentSummary> = {},
): ContentSummary => ({ id, title, objectType: "ARTICLE", ...extra });

function feed(...items: ContentSummary[]) {
  return { items, nextCursor: null };
}

function renderPage(url = "/discover") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <DiscoverPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  topics.mockResolvedValue([]);
  discover.mockResolvedValue(feed());
});

describe("discover page", () => {
  it("shows the loading state while the feed is pending", () => {
    discover.mockReturnValue(new Promise(() => {}));
    topics.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    expect(discover).toHaveBeenCalledWith({ limit: 20 });
  });

  it("loads the feed through the discover API and renders it under the masthead", async () => {
    discover.mockResolvedValue(feed(article("c1", "真实发现内容")));

    renderPage();

    expect(await screen.findByText("真实发现内容")).toBeInTheDocument();
    expect(discover).toHaveBeenCalledWith({ limit: 20 });
    expect(topics).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "探索发现" })).toBeInTheDocument();
  });

  it("renders every real topic as a filter button, including one with no content", async () => {
    topics.mockResolvedValue([
      { id: "t-design", slug: "design", name: "设计", contentCount: 3 },
      { id: "t-empty", slug: "zero", name: "空话题", contentCount: 0 },
      { id: "t-ai", slug: "ai", name: "AI", contentCount: 1 },
    ]);
    discover.mockResolvedValue(feed(article("c1", "初始列表内容")));

    renderPage();

    const allTopics = screen.getByRole("button", { name: "全部话题" });
    expect(allTopics).toHaveAttribute("aria-pressed", "true");
    const emptyTopic = await screen.findByRole("button", { name: /空话题/ });
    expect(emptyTopic).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /设计/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI/ })).toBeInTheDocument();
    // Topics are filters now, not editorial navigation links, and they do not
    // disappear because their content count is zero.
    expect(screen.queryByRole("link", { name: /空话题/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(await screen.findByText("初始列表内容")).toBeInTheDocument();

    discover.mockResolvedValue(feed(article("c2", "空话题内容")));
    fireEvent.click(emptyTopic);

    await waitFor(() =>
      expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "zero" }),
    );
    expect(emptyTopic).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("空话题内容")).toBeInTheDocument();
  });

  it("keeps the server feed order and does not promote or regroup featured items", async () => {
    /*
     * Deliberately neither title order nor creation order. The page must render
     * `items` as delivered; picking featured rows out to build an editorial
     * block would reorder this fixture and is the regression this guards against.
     */
    discover.mockResolvedValue(
      feed(
        article("c3", "丙内容"),
        article("c1", "甲内容", { featured: true }),
        { id: "s2", title: "乙内容", objectType: "SERIES", featured: true },
        article("c2", "丁内容"),
      ),
    );

    renderPage();

    const titles = [
      await screen.findByText("丙内容"),
      screen.getByText("甲内容"),
      screen.getByText("乙内容"),
      screen.getByText("丁内容"),
    ];
    for (let index = 0; index < titles.length - 1; index += 1) {
      expect(
        titles[index].compareDocumentPosition(titles[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: "更多内容" })).not.toBeInTheDocument();
  });

  it("shows the empty state when the feed has no content", async () => {
    discover.mockResolvedValue(feed());

    renderPage();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("社区还在生长中")).toBeInTheDocument();
  });

  it("shows the error state when the feed fails and recovers on retry", async () => {
    discover.mockRejectedValueOnce(new Error("boom"));

    renderPage();

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.queryByText("恢复后的内容")).not.toBeInTheDocument();

    discover.mockResolvedValueOnce(feed(article("c1", "恢复后的内容")));
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("恢复后的内容")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("keeps the feed visible and says so when topics fail", async () => {
    topics.mockRejectedValue(new Error("offline"));
    discover.mockResolvedValue(feed(article("c1", "内容仍然可见")));

    renderPage();

    expect(await screen.findByText("内容仍然可见")).toBeInTheDocument();
    expect(screen.getByText("话题暂时无法加载。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部话题" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
