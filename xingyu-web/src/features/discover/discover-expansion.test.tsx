import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
  return screen.getAllByRole("button").filter((element) => element.hasAttribute("data-discover-trigger"));
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

function variants() {
  return expandableRows().map((row) => row.closest("[data-discover-variant]")?.getAttribute("data-discover-variant"));
}

it("derives normal, compact and expanded variants from the single expanded row without reloading the feed", async () => {
  renderPage();
  await screen.findByText("第一篇");
  expect(variants()).toEqual(["normal", "normal"]);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  expect(variants()).toEqual(["expanded", "compact"]);
  fireEvent.click(screen.getByText("第二篇"));
  await screen.findByText("正文 b");
  expect(variants()).toEqual(["compact", "expanded"]);
  fireEvent.click(screen.getByText("第二篇"));
  expect(variants()).toEqual(["normal", "normal"]);
  expect(discover).toHaveBeenCalledTimes(1);
});

it("connects the keyboard trigger to its reading panel", async () => {
  renderPage();
  await screen.findByText("第一篇");
  const trigger = expandableRows()[0];
  fireEvent.keyDown(trigger, { key: "Enter" });
  await screen.findByText("正文 a");
  const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
  expect(panel).toBeVisible();
  fireEvent.keyDown(trigger, { key: " " });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(panel).toHaveAttribute("inert");
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

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

function geometry(row: HTMLElement, y: number) {
  vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(0, y, 800, 800));
  const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]")!;
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(0, y, 800, 100));
}

it("leaves a sufficiently visible article in place and ignores descendant transitions", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第一篇").closest("li")!;
  geometry(row, 100);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  fireEvent.transitionEnd(screen.getByText("正文 a"), { propertyName: "max-height" });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("follows a header that slides under the sticky inset instead of correcting after the animation", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第二篇").closest("li")!;
  geometry(row, 520);
  const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]")!;
  // The compacted rows above move the header above the reading inset mid-flight.
  vi.mocked(trigger.getBoundingClientRect).mockReturnValue(new DOMRect(0, -60, 800, 100));
  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 340, behavior: "instant" }));
  expect(scroll).not.toHaveBeenCalledWith({ top: 400, behavior: "instant" });
});

it("cancels obsolete positioning when rapidly switching or collapsing", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 800 });
  renderPage();
  await screen.findByText("第一篇");
  const first = screen.getByText("第一篇").closest("li")!;
  const second = screen.getByText("第二篇").closest("li")!;
  geometry(first, 900);
  geometry(second, 1200);
  vi.mocked(first.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, -40, 800, 100));
  const secondTrigger = second.querySelector<HTMLElement>("[data-discover-trigger]")!;
  vi.mocked(secondTrigger.getBoundingClientRect).mockReturnValue(new DOMRect(0, -10, 800, 100));
  fireEvent.click(screen.getByText("第一篇"));
  fireEvent.click(screen.getByText("第二篇"));
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 790, behavior: "instant" }));
  expect(scroll).not.toHaveBeenCalledWith({ top: 760, behavior: "instant" });
  scroll.mockClear();
  geometry(first, 100);
  vi.mocked(first.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, 100, 800, 100));
  fireEvent.click(screen.getByText("第一篇"));
  fireEvent.click(screen.getByText("第一篇"));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("keeps a collapsing header on screen when restored rows above push it down", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第二篇").closest("li")!;
  geometry(row, 120);
  fireEvent.click(screen.getByText("第二篇"));
  await screen.findByText("正文 b");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  scroll.mockClear();
  fireEvent.click(screen.getByText("第二篇"));
  vi.mocked(row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, 900, 800, 100));
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 232, behavior: "instant" }));
});

it("keeps the page position when a visible article collapses", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第二篇").closest("li")!;
  geometry(row, 120);
  fireEvent.click(screen.getByText("第二篇"));
  await screen.findByText("正文 b");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  scroll.mockClear();
  fireEvent.click(screen.getByText("第二篇"));
  // Rows above regain their normal height while the panel closes; the view must
  // not be re-anchored once the layout settles.
  vi.mocked(row.getBoundingClientRect).mockReturnValue(new DOMRect(0, 320, 800, 160));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("restores the collapsed article context when its body was far above the viewport", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第一篇").closest("li")!;
  geometry(row, 100);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 });
  vi.mocked(row.getBoundingClientRect).mockReturnValue(new DOMRect(0, -900, 800, 1500));
  vi.mocked(row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, -880, 800, 100));
  fireEvent.click(screen.getByRole("button", { name: "收起阅读" }));
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 100, behavior: "instant" }));
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

it("restores deep mobile collapse context before the next paint", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const media = window.matchMedia("all");
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ ...media, matches: query.includes("max-width: 1023px") }));
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第一篇").closest("li")!;
  geometry(row, 100);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  scroll.mockClear();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 });
  vi.mocked(row.getBoundingClientRect).mockReturnValue(new DOMRect(0, -900, 800, 1500));
  vi.mocked(row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, -880, 800, 100));
  fireEvent.click(screen.getByRole("button", { name: "收起阅读" }));
  expect(scroll).toHaveBeenCalledWith({ top: 100, behavior: "instant" });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

it("lets deliberate user scrolling cancel pending automatic positioning", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第二篇").closest("li")!;
  geometry(row, 520);
  vi.mocked(row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
    .mockReturnValue(new DOMRect(0, -100, 800, 100));
  fireEvent.click(screen.getByText("第二篇"));
  fireEvent.wheel(window, { deltaY: 200 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("suspends page scroll anchoring for the newest layout task and restores it on cancellation", async () => {
  renderPage();
  await screen.findByText("第一篇");
  fireEvent.click(screen.getByText("第一篇"));
  expect(document.documentElement.style.overflowAnchor).toBe("none");
  fireEvent.click(screen.getByText("第二篇"));
  expect(document.documentElement.style.overflowAnchor).toBe("none");
  fireEvent.wheel(window);
  expect(document.documentElement.style.overflowAnchor).toBe("");
  await screen.findByText("正文 b");
});

it("measures the sticky header and row inset instead of using a fixed page offset", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const header = document.createElement("header");
  header.className = "sticky";
  document.body.append(header);
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 64));
  try {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 500 });
    renderPage();
    await screen.findByText("第一篇");
    const row = screen.getByText("第二篇").closest("li")!;
    row.querySelector<HTMLElement>("[data-discover-variant]")!.style.paddingTop = "20px";
    geometry(row, 900);
    // 64px shell header + 20px row inset: the header is pushed under that inset
    // and the page scrolls up by exactly the measured amount.
    vi.mocked(row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect)
      .mockReturnValue(new DOMRect(0, 0, 800, 100));
    fireEvent.click(screen.getByText("第二篇"));
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 416, behavior: "instant" }));
  } finally { header.remove(); }
});

it("keeps a visible article where the user opened it even when its reading box passes the fold", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  renderPage();
  await screen.findByText("第一篇");
  geometry(screen.getByText("第一篇").closest("li")!, 100);
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-reading-viewport") || this.classList.contains("discover-reading-placeholder")
      ? new DOMRect(0, 740, 600, 400)
      : originalRect.call(this);
  });
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("sizes the open panel from the measured content instead of a one-shot height", async () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList?.contains("discover-panel-content")
      ? new DOMRect(0, 0, 600, 240)
      : originalRect.call(this);
  });
  try {
    renderPage();
    await screen.findByText("第一篇");
    fireEvent.click(screen.getByText("第一篇"));
    const clip = document.querySelector<HTMLElement>(".discover-panel-clip")!;
    await waitFor(() => expect(clip.style.height).toBe("240px"));
  } finally {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockRestore();
  }
});

it("cancels pending positioning when the page unmounts", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = renderPage();
  await screen.findByText("第一篇");
  geometry(screen.getByText("第一篇").closest("li")!, 900);
  fireEvent.click(screen.getByText("第一篇"));
  view.unmount();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
  expect(scroll).not.toHaveBeenCalled();
});

it("collapses the open row when content type changes", async () => {
  renderPage();
  await screen.findByText("第一篇");
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  fireEvent.click(screen.getByRole("button", { name: "文章" }));
  await waitFor(() => expect(variants()).toEqual(["normal", "normal"]));
  expect(document.querySelector(".discover-layout")).toHaveAttribute("data-focused", "false");
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
