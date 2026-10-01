import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
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

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: { getTopics: vi.fn() },
}));

const mocked = vi.mocked(discoverApi);
const topicsMocked = vi.mocked(topicsApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  topicsMocked.getTopics.mockResolvedValue([]);
});

describe("discover page", () => {
  it("shows a loading state while discover content is pending", () => {
    mocked.getDiscover.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

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
    expect(screen.getByRole("heading", { name: "发现" })).toBeInTheDocument();
  });

  it("renders real topics as exploration links", async () => {
    topicsMocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "design", name: "设计", contentCount: 3 },
      { id: "t2", slug: "ai", name: "AI", contentCount: 1 },
    ]);
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    expect(await screen.findByRole("link", { name: /设计.*3 篇内容/ })).toHaveAttribute(
      "href",
      "/topics/design",
    );
    expect(screen.getByRole("link", { name: /AI.*1 篇内容/ })).toHaveAttribute(
      "href",
      "/topics/ai",
    );
  });

  it("filters empty topics and links to the full topics page", async () => {
    topicsMocked.getTopics.mockResolvedValue([
      { id: "zero", slug: "zero", name: "空话题", contentCount: 0 },
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `topic-${index}`,
        slug: `topic-${index}`,
        name: `话题 ${index}`,
        contentCount: index + 1,
      })),
    ]);
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    expect(await screen.findByTestId("discover-topics-list")).toBeInTheDocument();
    expect(screen.queryByText("空话题")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看全部话题/ })).toHaveAttribute("href", "/topics");
  });

  it("organizes three or more items into primary, secondary and more content", async () => {
    mocked.getDiscover.mockResolvedValue({
      items: [
        { id: "c1", title: "主焦点", objectType: "ARTICLE", summary: "主摘要" },
        { id: "c2", title: "次级焦点一", objectType: "SERIES" },
        { id: "c3", title: "次级焦点二", objectType: "MOMENT" },
        { id: "c4", title: "更多内容", objectType: "ARTICLE" },
      ],
      total: 4,
      nextCursor: null,
    });

    renderPage();

    expect(await screen.findByTestId("discover-focus-grid")).toBeInTheDocument();
    expect(screen.getByTestId("discover-focus-primary")).toHaveTextContent("主焦点");
    expect(screen.getAllByTestId("discover-focus-secondary")).toHaveLength(2);
    expect(screen.getByTestId("discover-focus-secondary-stack")).toHaveClass("items-stretch");
    expect(screen.getByTestId("discover-focus-grid")).toHaveClass(
      "lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]",
    );
    expect(screen.getByRole("heading", { name: "更多内容" })).toBeInTheDocument();
  });

  it("falls back to the regular grid for fewer than three items", async () => {
    mocked.getDiscover.mockResolvedValue({
      items: [
        { id: "c1", title: "单条内容", objectType: "ARTICLE" },
        { id: "c2", title: "第二条内容", objectType: "SERIES" },
      ],
      total: 2,
      nextCursor: null,
    });

    renderPage();

    expect(await screen.findByTestId("discover-results")).toBeInTheDocument();
    expect(screen.queryByTestId("discover-focus-grid")).not.toBeInTheDocument();
  });

  it("hides the exploration section when topics are empty", async () => {
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    await screen.findByTestId("page-state-empty");
    expect(screen.queryByTestId("discover-topics-list")).not.toBeInTheDocument();
  });

  it("keeps discover content when topics fail", async () => {
    topicsMocked.getTopics.mockRejectedValue(new Error("boom"));
    mocked.getDiscover.mockResolvedValue({
      items: [{ id: "c1", title: "内容仍然可见", objectType: "ARTICLE" }],
      total: 1,
      nextCursor: null,
    });

    renderPage();

    expect(await screen.findByText("内容仍然可见")).toBeInTheDocument();
    expect(screen.getByText("探索方向暂时无法加载。")).toBeInTheDocument();
  });

  it("does not render fake domain or sort filters", async () => {
    mocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });

    renderPage();

    await screen.findByTestId("page-state-empty");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("全部")).not.toBeInTheDocument();
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
