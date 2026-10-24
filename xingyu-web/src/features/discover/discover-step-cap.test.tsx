import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { DiscoverPage } from "./pages/DiscoverPage";

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

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/discover"]}>
      <AuthProvider>
        <DiscoverPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** A window scroll that actually moves the viewport, recording every requested top. */
function scrollViewport() {
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  const requested: number[] = [];
  vi.spyOn(window, "scrollTo").mockImplementation((options: ScrollToOptions | number) => {
    const top = Math.max(0, typeof options === "number" ? options : (options.top ?? 0));
    requested.push(top);
    Object.defineProperty(window, "scrollY", { configurable: true, value: top });
  });
  return requested;
}

function followViewport(row: HTMLElement, documentTop: number) {
  vi.spyOn(row, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, documentTop - window.scrollY, 800, 800),
  );
  const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]")!;
  vi.spyOn(trigger, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, documentTop - window.scrollY, 800, 100),
  );
}

/*
 * A critically damped spring covers a fixed fraction of the remaining distance
 * per frame, so its first step grows with the gap it is closing. Opened from rest
 * 300px below the sticky inset, the first paint used to ask for 111px — the whole
 * ease arrived as one jump. The loop now caps how far a single paint may move the
 * viewport, and this is the assertion that holds it to that cap.
 */
const MAX_STEP = 24;

function largestStep(requested: number[]) {
  let largest = 0;
  for (let index = 1; index < requested.length; index += 1) {
    largest = Math.max(largest, Math.abs(requested[index] - requested[index - 1]));
  }
  return largest;
}

it("never moves the viewport more than the cap in one paint when opening a far row", async () => {
  const requested = scrollViewport();
  renderPage();
  await screen.findByText("第一篇");
  followViewport(screen.getByText("第一篇").closest("li")!, 300);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await waitFor(() => expect(Math.abs(window.scrollY - 300)).toBeLessThan(1.5));
  expect(requested.length).toBeGreaterThan(3);
  expect(largestStep(requested)).toBeLessThanOrEqual(MAX_STEP + 0.5);
});

/*
 * Switching is the same easing against a target it cannot measure yet: the
 * article being replaced is still expanded when the request is prepared, so the
 * loop aims at an estimate and finishes on the measured error. Crossing a row a
 * screen and a half away is the largest gap a switch can ask for, and it must
 * arrive under the same per-paint budget as an open.
 */
it("holds a switch across a distant row to the same per-paint budget", async () => {
  const requested = scrollViewport();
  renderPage();
  await screen.findByText("第一篇");
  followViewport(screen.getByText("第一篇").closest("li")!, 200);
  followViewport(screen.getByText("第二篇").closest("li")!, 1600);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await waitFor(() => expect(Math.abs(window.scrollY - 200)).toBeLessThan(1.5));

  requested.length = 0;
  fireEvent.click(screen.getByText("第二篇"));
  await screen.findByText("正文 b");
  await waitFor(() => expect(Math.abs(window.scrollY - 1600)).toBeLessThan(1.5));
  expect(requested.length).toBeGreaterThan(3);
  expect(largestStep(requested)).toBeLessThanOrEqual(MAX_STEP + 0.5);
});

/*
 * One write is deliberately outside the budget: restoring the collapse context
 * runs in the same task that flips the row, before any paint can show the
 * intermediate position, so there is no frame for the eye to see it split. That
 * is the "first scroll" the per-paint assertion above cannot cover — it happens
 * before the loop starts. Everything after it is capped like any other paint.
 */
it("places the collapse context in one task, then caps every later paint", async () => {
  const media = window.matchMedia("all");
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...media,
    matches: query.includes("max-width: 1023px"),
  }));
  const requested = scrollViewport();
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第一篇").closest("li")!;
  followViewport(row, 100);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await waitFor(() => expect(Math.abs(window.scrollY - 100)).toBeLessThan(1.5));

  requested.length = 0;
  // The reader has scrolled far past the open article before collapsing it.
  Object.defineProperty(window, "scrollY", { configurable: true, value: 2000 });
  fireEvent.click(screen.getByRole("button", { name: "收起阅读" }));
  // The row lives at documentTop 100, so the collapse context lands there in a
  // single write — 1900px, far over the cap, and correct.
  expect(requested[0]).toBe(100);
  const later = requested.slice(1);
  expect(largestStep([requested[0], ...later])).toBeLessThanOrEqual(MAX_STEP + 0.5);
});

/*
 * The other half of the collapse paths: a row that is still fully visible keeps
 * the reader's position. No loop, no correction, no write at all.
 */
it("does not touch the viewport when a visible row collapses", async () => {
  const requested = scrollViewport();
  renderPage();
  await screen.findByText("第一篇");
  const row = screen.getByText("第一篇").closest("li")!;
  followViewport(row, 100);
  fireEvent.click(screen.getByText("第一篇"));
  await screen.findByText("正文 a");
  await waitFor(() => expect(Math.abs(window.scrollY - 100)).toBeLessThan(1.5));

  requested.length = 0;
  // Freeze the geometry where it settled: the row is on screen and short enough
  // that its restored neighbours cannot push anything off.
  vi.mocked(row.getBoundingClientRect).mockReturnValue(new DOMRect(0, 100, 800, 160));
  vi.mocked(
    row.querySelector<HTMLElement>("[data-discover-trigger]")!.getBoundingClientRect,
  ).mockReturnValue(new DOMRect(0, 100, 800, 100));
  fireEvent.click(screen.getByRole("button", { name: "收起阅读" }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  expect(requested).toEqual([]);
});
