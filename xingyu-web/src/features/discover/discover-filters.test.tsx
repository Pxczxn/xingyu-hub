import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { DiscoverPage } from "./pages/DiscoverPage";

vi.mock("@/api/discover/discover.api", () => ({ discoverApi: { getDiscover: vi.fn() } }));
vi.mock("@/api/topics/topics.api", () => ({ topicsApi: { getTopics: vi.fn() } }));
const discover = vi.mocked(discoverApi.getDiscover);
const topics = vi.mocked(topicsApi.getTopics);
const article = (id: string) => ({ id, title: id, objectType: "ARTICLE" as const });
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function renderPage(url = "/discover") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <DiscoverPage />
        <Location />
      </AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  topics.mockResolvedValue([
    { id: "t-design", slug: "design", name: "设计", contentCount: 3 },
    { id: "t-ai", slug: "ai", name: "AI", contentCount: 1 },
  ]);
  discover.mockResolvedValue({ items: [article("全部内容第一篇")], nextCursor: "all-next" });
});
it("filters in place by topic and resets the previous list and cursor", async () => {
  renderPage();
  expect(await screen.findByText("全部内容第一篇")).toBeInTheDocument();
  const topic = screen.getByRole("button", { name: /设计/ });
  discover.mockResolvedValueOnce({ items: [article("设计文章")], nextCursor: "design-next" });
  fireEvent.click(topic);
  expect(await screen.findByText("设计文章")).toBeInTheDocument();
  expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "design" });
  expect(screen.queryByText("全部内容第一篇")).not.toBeInTheDocument();
  expect(topic).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("location")).toHaveTextContent("/discover?topic=design");
  discover.mockResolvedValueOnce({ items: [article("设计文章第二篇")], nextCursor: null });
  fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
  expect(await screen.findByText("设计文章第二篇")).toBeInTheDocument();
  expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "design", cursor: "design-next" });
});
it("combines topic and content type, and all topics clears only the topic", async () => {
  renderPage("/discover?topic=design");
  await screen.findByText("全部内容第一篇");
  fireEvent.click(screen.getByRole("button", { name: "文章" }));
  await waitFor(() =>
    expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "design", type: "ARTICLE" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "全部话题" }));
  await waitFor(() => expect(discover).toHaveBeenLastCalledWith({ limit: 20, type: "ARTICLE" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/discover?type=ARTICLE");
});
it("ignores an old load-more response after the topic changes", async () => {
  let resolveMore!: (value: Awaited<ReturnType<typeof discover>>) => void;
  renderPage();
  await screen.findByText("全部内容第一篇");
  discover.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveMore = resolve;
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
  discover.mockResolvedValueOnce({ items: [article("AI内容")], nextCursor: null });
  fireEvent.click(screen.getByRole("button", { name: /^AI/ }));
  await screen.findByText("AI内容");
  await act(async () => {
    resolveMore({ items: [article("旧筛选结果")], nextCursor: "stale" });
  });
  expect(screen.queryByText("旧筛选结果")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
});
it("reports an empty filtered result instead of saying the community has no content", async () => {
  discover.mockResolvedValue({ items: [], nextCursor: null });
  renderPage("/discover?topic=design");
  expect(await screen.findByText("暂无符合筛选条件的内容")).toBeInTheDocument();
  expect(screen.queryByText("社区还在生长中")).not.toBeInTheDocument();
});

it("locks moments and series while a topic is active, and normalizes a stale topic+type URL", async () => {
  renderPage("/discover?topic=design&type=MOMENT");
  await screen.findByText("全部内容第一篇");

  // 组合无效：按“话题内的全部文章”请求，而不是让后端返回空列表。
  expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "design" });
  // 地址栏里的 type 被清掉，分享出去的链接不会再把同一个无效组合带给别人。
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent("/discover?topic=design"),
  );
  expect(screen.getByTestId("location")).not.toHaveTextContent("type=MOMENT");

  expect(screen.getByRole("button", { name: "动态" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "系列" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "文章" })).toBeEnabled();
  expect(screen.getByTestId("discover-topic-type-hint")).toHaveTextContent("话题只归类文章");
});
it("keeps content visible and reports topic loading failure", async () => {
  topics.mockRejectedValue(new Error("offline"));
  renderPage();
  expect(await screen.findByText("全部内容第一篇")).toBeInTheDocument();
  expect(screen.getByText("话题暂时无法加载。")).toBeInTheDocument();
});
it("shows every topic as a filter, without the decorative prompt or inactive hot filter", async () => {
  topics.mockResolvedValue(
    Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, slug: `topic-${i}`, name: `话题${i}` })),
  );
  renderPage();
  expect(await screen.findByRole("button", { name: "话题9" })).toBeInTheDocument();
  expect(screen.queryByText("热门推荐")).not.toBeInTheDocument();
  expect(
    screen.queryByText("探索更多优质内容，发现你感兴趣的话题和创作者。"),
  ).not.toBeInTheDocument();
});
