import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { DiscoverPage } from "./pages/DiscoverPage";

/*
 * The discovery list is an accordion: expanding one row collapses the other.
 * Every row also shares the /discover URL, so two open rows would push the
 * second one's directory and comments far below the fold with no way to tell
 * which row the directory belongs to.
 */

vi.mock("@/api/discover/discover.api", () => ({ discoverApi: { getDiscover: vi.fn() } }));
vi.mock("@/api/topics/topics.api", () => ({ topicsApi: { getTopics: vi.fn() } }));
vi.mock("@/api/articles/articles.api", () => ({ articlesApi: { getArticle: vi.fn() } }));
vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: { getComments: vi.fn(), getCommentPreview: vi.fn() },
}));

const discover = vi.mocked(discoverApi.getDiscover);
const topics = vi.mocked(topicsApi.getTopics);
const getArticle = vi.mocked(articlesApi.getArticle);
const getComments = vi.mocked(interactionsApi.getComments);
const getPreview = vi.mocked(interactionsApi.getCommentPreview);

const rows = [
  { id: "a", title: "第一篇", objectType: "ARTICLE" as const },
  { id: "b", title: "第二篇", objectType: "ARTICLE" as const },
];

function expandableRows() {
  return screen.getAllByRole("button").filter((element) => element.hasAttribute("aria-expanded"));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/discover"]}>
      <AuthProvider>
        <DiscoverPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function articleDetail(id: string): ArticleDetail {
  return {
    id,
    title: id,
    summary: null,
    body: `正文 ${id}`,
    slug: null,
    visibility: "PUBLIC",
    spaceSlug: "space",
    ownerUsername: "owner",
    publishedAt: null,
    owner: false,
    seriesContexts: [],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  topics.mockResolvedValue([]);
  discover.mockResolvedValue({ items: rows, nextCursor: null });
  getArticle.mockImplementation(async (articleId: string) => articleDetail(articleId));
  getComments.mockResolvedValue([]);
  getPreview.mockResolvedValue([]);
});

it("keeps a single row expanded at a time", async () => {
  renderPage();
  await screen.findByText("第一篇");
  expect(expandableRows().map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "false"]);

  fireEvent.click(screen.getByText("第一篇"));
  expect(await screen.findByText("正文 a")).toBeInTheDocument();
  expect(expandableRows().map((row) => row.getAttribute("aria-expanded"))).toEqual(["true", "false"]);

  fireEvent.click(screen.getByText("第二篇"));
  expect(await screen.findByText("正文 b")).toBeInTheDocument();
  await waitFor(() => expect(expandableRows().map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "true"]));
  expect(screen.queryByText("正文 a")).not.toBeInTheDocument();

  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(expandableRows().map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "false"]));
  expect(screen.queryByText("正文 b")).not.toBeInTheDocument();
});

it("scrolls the newly opened row into view", async () => {
  renderPage();
  await screen.findByText("第一篇");
  const secondRow = screen.getByText("第二篇").closest("li")!;
  const scroll = vi.spyOn(secondRow, "scrollIntoView");
  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
});

it("keeps aligning the newly opened row when another row is still closing", async () => {
  renderPage();
  await screen.findByText("第一篇");
  fireEvent.click(screen.getByText("第一篇"));
  expect(await screen.findByText("正文 a")).toBeInTheDocument();
  const firstRow = screen.getByText("第一篇").closest("li")!;
  const secondRow = screen.getByText("第二篇").closest("li")!;
  const firstScroll = vi.spyOn(firstRow, "scrollIntoView");
  const secondScroll = vi.spyOn(secondRow, "scrollIntoView");
  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(secondScroll).toHaveBeenCalledTimes(1));
  const expandEnded = new Event("transitionend", { bubbles: true });
  Object.defineProperty(expandEnded, "propertyName", { value: "max-height" });
  secondRow.dispatchEvent(expandEnded);
  await waitFor(() => expect(secondScroll).toHaveBeenCalledTimes(2));
  // Only the row that opened is realigned; the row closing above it must not
  // pull the reader back to where they were. Its spy is installed after it was
  // opened, so any call here would be a re-align caused by the switch.
  expect(firstScroll).not.toHaveBeenCalled();
});

it("re-aligns the opened row once its own expand animation has grown the page", async () => {
  renderPage();
  await screen.findByText("第一篇");
  const secondRow = screen.getByText("第二篇").closest("li")!;
  const scroll = vi.spyOn(secondRow, "scrollIntoView");
  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
  // A row near the end of the page grows the document while it opens, so the
  // scroll position requested on the first pass is clamped by the height the
  // document still had. Only the row's own max-height transition says the page
  // is finally tall enough to pin it.
  const expandEnded = new Event("transitionend", { bubbles: true });
  Object.defineProperty(expandEnded, "propertyName", { value: "max-height" });
  secondRow.dispatchEvent(expandEnded);
  await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2));
  expect(scroll).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start" });
});

it("collapses the open row when the filter changes", async () => {
  topics.mockResolvedValue([{ id: "t-design", slug: "design", name: "设计" }]);
  renderPage();
  await screen.findByText("第一篇");
  fireEvent.click(screen.getByText("第一篇"));
  expect(await screen.findByText("正文 a")).toBeInTheDocument();
  discover.mockResolvedValueOnce({ items: rows, nextCursor: null });
  fireEvent.click(screen.getByRole("button", { name: /^设计/ }));
  await waitFor(() => expect(expandableRows().map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "false"]));
});
