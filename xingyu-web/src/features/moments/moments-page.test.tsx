import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth.store";
import { MomentsPage } from "./pages/MomentsPage";

vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    listMine: vi.fn(),
  },
}));

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    like: vi.fn(),
    unlike: vi.fn(),
    getLikeCount: vi.fn(),
    getLikeStatus: vi.fn(),
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: vi.fn(),
}));

const mocked = vi.mocked(momentsApi);
const mockedInteractions = vi.mocked(interactionsApi);
const mockedAuth = vi.mocked(useAuth);

const VIEW = {
  id: "m-1",
  body: "今晚看见流星",
  authorId: "user-a",
  createdAt: "2026-09-24T16:43:08Z",
};

/* The feed endpoint fills these; the single-moment one leaves them null. */
const COUNTED = { ...VIEW, likeCount: 5, commentCount: 2, liked: false };

function guestAuth() {
  mockedAuth.mockReturnValue({
    status: "unauthenticated",
    user: null,
    token: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

function signedInAuth() {
  mockedAuth.mockReturnValue({
    status: "authenticated",
    user: { email: "a@pxczxn.top", emailVerified: true },
    token: "tok",
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

function renderFeed() {
  return render(
    <MemoryRouter initialEntries={["/moments"]}>
      <Routes>
        <Route path="/moments" element={<MomentsPage />} />
        <Route path="/moments/:id" element={<div data-testid="detail-page" />} />
        <Route path="/login" element={<div data-testid="login-page">登录星语</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  guestAuth();
});

describe("MomentsPage", () => {
  it("shows loading while the feed request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderFeed();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows an empty feed", async () => {
    mocked.list.mockResolvedValue([]);
    renderFeed();
    expect(await screen.findByText("暂时还没有动态")).toBeInTheDocument();
  });

  it("shows an error state", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderFeed();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renders public feed body and time without a raw author id", async () => {
    mocked.list.mockResolvedValue([VIEW]);
    renderFeed();
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(document.querySelector(`time[datetime="${VIEW.createdAt}"]`)).toBeInTheDocument();
    expect(screen.queryByText("user-a")).not.toBeInTheDocument();
    expect(screen.queryByText("转发")).not.toBeInTheDocument();
    expect(screen.queryByText("浏览量")).not.toBeInTheDocument();
    expect(screen.queryByText("bookmark")).not.toBeInTheDocument();
  });

  /*
   * Batch 14 — the time is an AGE, not a timestamp.
   *
   * The card used to print `toLocaleString("zh-CN")`, i.e. `2026/09/24 16:43:08`
   * on every row: 19 characters, seconds included. `title` carries the exact
   * value, so nothing is lost — it just stops competing with the body.
   *
   * The assertions read `title` rather than the visible age on purpose: the age
   * is computed from `Date.now()`, and asserting `"2 天前"` would start failing
   * the moment the fixture ages past a boundary. `title` is a pure function of
   * `createdAt`, so it is stable forever.
   */
  it("shows a coarse age with the exact instant in the title attribute", async () => {
    mocked.list.mockResolvedValue([VIEW]);
    renderFeed();
    const time = await waitFor(() => {
      const found = document.querySelector(`time[datetime="${VIEW.createdAt}"]`);
      expect(found).not.toBeNull();
      return found as HTMLTimeElement;
    });
    expect(time.getAttribute("title")).toBe("2026/09/25 00:43");
    expect(time.textContent).not.toContain(":");
  });

  /*
   * The action row. Before batch 14 the whole card was one `<Link>`, so there
   * was nowhere for a like button to live — a reader who wanted to respond had
   * to open the moment first, and a guest had no route from "I like this" to
   * "here is how". The counts now arrive with the list (one batched query
   * server-side), which is why the buttons can show them without a request
   * each.
   */
  it("renders the batched counts in an action row", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([COUNTED]);
    renderFeed();
    expect(await screen.findByRole("button", { name: "5 次点赞" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2 条评论" })).toBeInTheDocument();
    // A response that predates the counters still renders: `?? 0` → "点赞".
    expect(mockedInteractions.getLikeCount).not.toHaveBeenCalled();
  });

  it("likes optimistically and rolls back the snapshot when the call fails", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([COUNTED]);
    /* A deferred promise, so the test can observe the intermediate state.
       With an immediately-rejecting mock the rollback can land in the same
       tick as the optimistic write, and the assertion on `6` would be racing
       the failure rather than observing the optimistic half. */
    let reject!: (reason: unknown) => void;
    mockedInteractions.like.mockReturnValue(
      new Promise<void>((_resolve, rej) => {
        reject = rej;
      }),
    );
    renderFeed();
    const button = await screen.findByRole("button", { name: "5 次点赞" });
    fireEvent.click(button);

    // The count moves BEFORE the request settles — that is the optimistic half.
    await waitFor(() => expect(button).toHaveAttribute("aria-label", "6 次点赞"));
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(mockedInteractions.like).toHaveBeenCalledWith("MOMENT", "m-1");

    // ...and returns to the SNAPSHOT when it rejects, not to `6 - 1` recomputed.
    reject(new Error("network"));
    await waitFor(() => expect(button).toHaveAttribute("aria-label", "5 次点赞"));
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(mockedInteractions.unlike).not.toHaveBeenCalled();
  });

  it("unlikes a moment that is already liked", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([{ ...COUNTED, liked: true }]);
    mockedInteractions.unlike.mockResolvedValue(undefined);
    renderFeed();
    const button = await screen.findByRole("button", { name: "5 次点赞" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-label", "4 次点赞"));
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(mockedInteractions.unlike).toHaveBeenCalledWith("MOMENT", "m-1");
    expect(mockedInteractions.like).not.toHaveBeenCalled();
  });

  it("sends a guest to login instead of a like button", async () => {
    mocked.list.mockResolvedValue([COUNTED]);
    renderFeed();
    const link = await screen.findByRole("link", { name: /5 次点赞，登录后可以点赞/ });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fmoments");
    expect(screen.queryByRole("button", { name: "5 次点赞" })).not.toBeInTheDocument();
  });

  /*
   * 关于动态（2026-11-10 · 批次 W1 改判）。
   *
   * 这条用例原来断言「关于动态」在一条 `hidden lg:block` 的 `complementary` 侧轨里。
   * 阶段三把本页的轴定为 SK2 · 线/紧/**齐**（A §3 的 /moments 行），而 R=齐 的定义是
   * 「全部区块与内容列同宽同边」—— 保留一条 sticky 侧轨会同时违反 R=齐 与 A §2 的
   * 四元组判定。所以这一块回到内容流末尾，成为页脚说明。
   *
   * 被有意改变的只有**视觉结构**这一条：标题仍是「关于动态」，正文一字未改。
   * 断言的意图（这条说明必须存在于页面上并且有名字）保持，只是把「在侧轨里」
   * 换成「在流里、且页面没有侧轨」。
   */
  it("keeps the notes in the flow instead of a side rail", async () => {
    mocked.list.mockResolvedValue([]);
    renderFeed();
    expect(await screen.findByRole("heading", { name: "关于动态" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("sends a guest who tries to publish to login with returnTo=/moments", async () => {
    mocked.list.mockResolvedValue([]);
    renderFeed();
    const link = await screen.findByRole("link", { name: "发布动态" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fmoments");
  });

  it("rejects blank create without calling the API", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([]);
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "发布动态" }));
    expect(mocked.create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("请填写动态正文");
  });

  it("prevents duplicate POST while pending", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([]);
    mocked.create.mockReturnValue(new Promise(() => {}));
    renderFeed();
    fireEvent.change(await screen.findByLabelText("动态正文"), { target: { value: "新动态" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(mocked.create).toHaveBeenCalledTimes(1));
  });

  it("navigates to the new detail after a successful create", async () => {
    signedInAuth();
    mocked.list.mockResolvedValue([]);
    mocked.create.mockResolvedValue(VIEW);
    renderFeed();
    fireEvent.change(await screen.findByLabelText("动态正文"), {
      target: { value: "今晚看见流星" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    expect(await screen.findByTestId("detail-page")).toBeInTheDocument();
    expect(mocked.create).toHaveBeenCalledWith({ body: "今晚看见流星" });
  });
});
