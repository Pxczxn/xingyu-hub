import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ContentSummary } from "@/api/common.types";
import { homeApi } from "@/api/home/home.api";
import type { MeHomeView } from "@/api/home/home.types";
import { meInsightsApi } from "@/api/moments/moments.api";
import type { InsightsView } from "@/api/moments/moments.types";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import { StudioPage } from "./StudioPage";

/*
 * StudioPage — the /studio entry hub (设计方案 §3.6, 批次 06).
 *
 * The page's own header states the claim these tests exist to protect: THREE
 * INDEPENDENT READS, THREE INDEPENDENT DEGRADATIONS. `getMyHome` / `listMine` /
 * `meInsights` are fired in parallel and each keeps its own `Remote` state, so
 * a failed submissions list cannot blank the draft card.
 *
 * A refactor that folded the three into one `Promise.all` plus a single `error`
 * flag would still pass every other test in the repo — and would fail here.
 *
 * Query names deliberately avoid the ones StudioNav pins (its header lists
 * them: 新建文章 / 我的内容 / 我的系列 …). These tests render the page WITHOUT
 * the shell, so nothing collides today; keeping the names apart leaves room for
 * a future shell-level test.
 */

vi.mock("@/api/home/home.api", () => ({
  homeApi: { getMyHome: vi.fn() },
}));

vi.mock("@/api/moments/moments.api", () => ({
  meInsightsApi: { get: vi.fn() },
}));

vi.mock("@/api/submissions/submissions.api", () => ({
  submissionsApi: { listMine: vi.fn() },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ user: { email: "tester@pxczxn.top", username: "tester" } }),
}));

const mockedHome = vi.mocked(homeApi);
const mockedInsights = vi.mocked(meInsightsApi);
const mockedSubmissions = vi.mocked(submissionsApi);

function draft(over: Partial<ContentSummary> = {}): ContentSummary {
  return {
    id: "art-1",
    title: "第一篇草稿",
    updatedAt: "2026-09-28T02:00:00Z",
    ...over,
  };
}

function submission(over: Partial<ReviewSubmissionDetailView> = {}): ReviewSubmissionDetailView {
  return {
    id: "sub-1",
    articleId: "art-1",
    title: "投稿标题",
    status: "PENDING",
    submittedAt: "2026-09-27T02:00:00Z",
    ...over,
  };
}

function meHome(over: Partial<MeHomeView> = {}): MeHomeView {
  return {
    continueReading: [],
    followUpdates: [],
    recommendations: [],
    draftArticles: [],
    pendingActions: [],
    ...over,
  };
}

function insights(over: Partial<InsightsView> = {}): InsightsView {
  return {
    articleCount: 0,
    draftCount: 0,
    followerCount: 0,
    followingCount: 0,
    commentCount: 0,
    likeCount: 0,
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/studio"]}>
      <StudioPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedHome.getMyHome.mockResolvedValue(meHome());
  mockedInsights.get.mockResolvedValue(insights());
  mockedSubmissions.listMine.mockResolvedValue([]);
});

describe("P0 · 继续创作", () => {
  it("links the FIRST draft to the editor without re-sorting", async () => {
    mockedHome.getMyHome.mockResolvedValue(
      meHome({
        draftArticles: [
          draft({ id: "art-2", title: "第二篇草稿" }),
          draft({ id: "art-1", title: "第一篇草稿" }),
        ],
      }),
    );
    renderPage();
    // `draftArticles` arrives ordered `updated_at DESC` server-side
    // (ArticleMapper.listByOwnerId), so index 0 IS the newest. The page must
    // not re-sort — a client-side sort would be a second source of truth for
    // an order the server already guarantees.
    const link = await screen.findByRole("link", { name: /第二篇草稿/ });
    expect(link).toHaveAttribute("href", "/studio/content/art-2");
    expect(screen.queryByText("第一篇草稿")).not.toBeInTheDocument();
  });

  it("invites a first draft when the author has none", async () => {
    renderPage();
    expect(await screen.findByText(/还没有草稿/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /继续编辑/ })).not.toBeInTheDocument();
  });

  it("falls back to 未命名草稿 for a blank title", async () => {
    // `draft.getTitle()` can be blank even when the draft row exists — only a
    // MISSING row triggers HomeService's own fallback. Never render an empty
    // heading.
    mockedHome.getMyHome.mockResolvedValue(meHome({ draftArticles: [draft({ title: "   " })] }));
    renderPage();
    expect(await screen.findByText("未命名草稿")).toBeInTheDocument();
  });

  it("degrades the draft card alone when the home read fails", async () => {
    mockedHome.getMyHome.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByTestId("draft-unavailable")).toBeInTheDocument();
    // The one thing a studio must never lose, even with every read down: the
    // way to start writing.
    expect(screen.getByRole("link", { name: /写新文章/ })).toHaveAttribute(
      "href",
      "/studio/content/new",
    );
  });
});

describe("P1 · 待处理事项", () => {
  it("lists the pending submission and links to its detail", async () => {
    mockedSubmissions.listMine.mockResolvedValue([
      submission({ id: "sub-1", title: "等待中的投稿", status: "PENDING" }),
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "查看详情" });
    expect(link).toHaveAttribute("href", "/studio/submissions/sub-1");
    expect(screen.getByText("等待中的投稿")).toBeInTheDocument();
    expect(screen.getByText("待审核")).toBeInTheDocument();
  });

  it("filters decided submissions out of the band", async () => {
    mockedSubmissions.listMine.mockResolvedValue([
      submission({ id: "sub-1", title: "等待中的投稿", status: "PENDING" }),
      submission({ id: "sub-2", title: "已通过的投稿", status: "APPROVED" }),
    ]);
    renderPage();
    await screen.findByText("等待中的投稿");
    // A decided submission is not 待处理 — the row is filtered out entirely,
    // not merely relabelled.
    expect(screen.queryByText("已通过的投稿")).not.toBeInTheDocument();
  });

  it("renders no band at all when nothing is pending", async () => {
    mockedSubmissions.listMine.mockResolvedValue([submission({ status: "APPROVED" })]);
    renderPage();
    await act(async () => {});
    // An empty "待处理事项" heading would claim there is a queue to watch.
    expect(screen.queryByRole("heading", { name: "待处理事项" })).not.toBeInTheDocument();
  });

  it("carries the stagger delay inline, not as a class", async () => {
    mockedSubmissions.listMine.mockResolvedValue([
      submission({ id: "sub-1" }),
      submission({ id: "sub-2" }),
    ]);
    renderPage();
    const list = await screen.findByRole("list", { name: "待处理事项" });
    // `animate-rise-in` resets `animation-delay` whenever both land on the same
    // element, so the delay MUST be an inline style (lib/stagger.ts).
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((el) => el.style.animationDelay),
    ).toEqual(["0ms", "40ms"]);
  });

  it("keeps the draft card alive when the submissions read fails", async () => {
    mockedHome.getMyHome.mockResolvedValue(
      meHome({ draftArticles: [draft({ title: "不受影响的草稿" })] }),
    );
    mockedSubmissions.listMine.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByTestId("pending-unavailable")).toBeInTheDocument();
    // THE point of three independent states: this read's failure must not reach
    // the P0 card above it.
    expect(screen.getByRole("link", { name: /不受影响的草稿/ })).toBeInTheDocument();
  });
});

describe("P2 · 数据概览", () => {
  it("shows the four counters and omits the draft count", async () => {
    // 口径: `articleCount` counts PUBLISHED only, while `draftCount` is a DRAFT
    // count that includes trashed rows — a different definition of "文章数".
    // Showing both would put two incompatible numbers under one word.
    mockedInsights.get.mockResolvedValue(
      insights({
        articleCount: 7,
        draftCount: 333,
        likeCount: 42,
        commentCount: 9,
        followerCount: 15,
      }),
    );
    renderPage();
    const list = await screen.findByRole("list", { name: "数据概览" });
    expect(within(list).getByText("7")).toBeInTheDocument();
    expect(within(list).getByText("42")).toBeInTheDocument();
    expect(within(list).getByText("9")).toBeInTheDocument();
    expect(within(list).getByText("15")).toBeInTheDocument();
    expect(within(list).queryByText("333")).not.toBeInTheDocument();
  });

  it("degrades only the insights line when that read fails", async () => {
    mockedHome.getMyHome.mockResolvedValue(
      meHome({ draftArticles: [draft({ title: "仍然在的草稿" })] }),
    );
    mockedSubmissions.listMine.mockResolvedValue([submission({ title: "仍然在的投稿" })]);
    mockedInsights.get.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByTestId("insights-unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /仍然在的草稿/ })).toBeInTheDocument();
    expect(screen.getByText("仍然在的投稿")).toBeInTheDocument();
  });
});

describe("failure independence", () => {
  it("survives all three reads failing at once", async () => {
    mockedHome.getMyHome.mockRejectedValue(new Error("boom"));
    mockedSubmissions.listMine.mockRejectedValue(new Error("boom"));
    mockedInsights.get.mockRejectedValue(new Error("boom"));
    renderPage();
    // Every failure is NAMED. Folding "you have nothing" and "we could not find
    // out" into one blank would be the exact Legacy failure this page fixes.
    expect(await screen.findByTestId("draft-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("pending-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("insights-unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /写新文章/ })).toBeInTheDocument();
  });
});

describe("structure", () => {
  it("always offers the create entry and the way home", async () => {
    renderPage();
    // "Always" is the claim, so it gets asserted twice: once while the three
    // reads are still in flight, once after they settle. The second pass is
    // also what keeps their state updates inside act() instead of leaking into
    // the next test.
    const assertEntries = () => {
      expect(screen.getByRole("link", { name: /写新文章/ })).toHaveAttribute(
        "href",
        "/studio/content/new",
      );
      expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    };
    assertEntries();
    await act(async () => {});
    assertEntries();
  });

  it("greets the signed-in creator by handle", async () => {
    renderPage();
    expect(await screen.findByText(/tester，欢迎回来。/)).toBeInTheDocument();
  });

  it("leaves the seven destinations to the shell", async () => {
    renderPage();
    await act(async () => {});
    // §3.6 keeps the destinations in StudioNav, which WorkbenchShell renders on
    // every /studio route. A second copy here would give both instances the
    // same accessible name — a duplicate link for screen readers and an
    // ambiguous query for any role-based lookup.
    for (const label of ["我的系列", "我的内容", "投稿记录", "数据分析"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });
});
