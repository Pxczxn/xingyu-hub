import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AchievementBadgesPage } from "./AchievementBadgesPage";

const mockedList = vi.fn();

vi.mock("@/api/badges/badges.api", () => ({
  badgesApi: { list: () => mockedList() },
}));

/** The exact five the backend emits, with a realistic mix of earned/locked. */
const FIVE = [
  { id: "onboard", title: "入门完成", description: "完成入门引导", earned: true },
  { id: "first-post", title: "初次创作", description: "创建第一篇文章", earned: true },
  { id: "prolific", title: "勤耕不辍", description: "拥有 5 篇以上文章", earned: false },
  { id: "social", title: "社区之星", description: "粉丝达到 10", earned: false },
  { id: "profile", title: "名片完善", description: "填写个人简介", earned: false },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AchievementBadgesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedList.mockResolvedValue(FIVE);
});

describe("AchievementBadgesPage — content", () => {
  it("renders every badge the server returned, in a labelled list", async () => {
    renderPage();
    const list = await screen.findByLabelText("徽章列表");
    for (const badge of FIVE) {
      expect(within(list).getByText(badge.title)).toBeInTheDocument();
    }
  });

  it("keeps the server's criterion text on locked badges (the 'what to do')", async () => {
    renderPage();
    await screen.findByLabelText("徽章列表");
    // "粉丝达到 10" IS the instruction — replacing it with soft prose loses the bar.
    expect(screen.getByText("粉丝达到 10")).toBeInTheDocument();
    expect(screen.getByText("拥有 5 篇以上文章")).toBeInTheDocument();
  });

  it("shows the earned/locked state per badge", async () => {
    renderPage();
    await screen.findByLabelText("徽章列表");
    expect(screen.getByTestId("badge-state-onboard")).toHaveTextContent("已点亮");
    expect(screen.getByTestId("badge-state-prolific")).toHaveTextContent("未点亮");
  });

  it("counts lit badges in the summary", async () => {
    renderPage();
    await screen.findByLabelText("徽章列表");
    // Two of the five are earned.
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("已点亮 2 / 5")).toBeInTheDocument();
  });

  it("puts earned badges before locked ones", async () => {
    renderPage();
    const list = await screen.findByLabelText("徽章列表");
    const items = within(list)
      .getAllByRole("listitem")
      .map((el) => el.getAttribute("data-testid"));
    expect(items.indexOf("badge-onboard")).toBeLessThan(items.indexOf("badge-prolific"));
    expect(items.indexOf("badge-first-post")).toBeLessThan(items.indexOf("badge-social"));
  });
});

describe("AchievementBadgesPage — the two Legacy lies are not repeated", () => {
  it("does NOT promise hidden badges", async () => {
    renderPage();
    const body = (await screen.findByLabelText("徽章列表")).closest("div.section-gap");
    // Legacy footer: "更多隐藏徽章等待你去发现". The server returns exactly five.
    expect(body?.textContent ?? "").not.toContain("隐藏徽章");
    expect(document.body.textContent ?? "").not.toContain("隐藏徽章");
  });

  it("does NOT invent a level or rank", async () => {
    renderPage();
    await screen.findByLabelText("徽章列表");
    // Legacy showed a "星语探索者" level card; no backend concept of a level exists.
    expect(document.body.textContent ?? "").not.toContain("星语探索者");
    expect(document.body.textContent ?? "").not.toContain("等级");
  });

  it("phrases progress as a snapshot, not a permanent trophy shelf", async () => {
    renderPage();
    await screen.findByLabelText("徽章列表");
    // `earned` is recomputed per request, so "已获得" would over-claim.
    expect(document.body.textContent ?? "").toContain("当前已点亮");
    expect(document.body.textContent ?? "").not.toContain("已获得");
  });

  it("explains that it is not a normal empty state", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    // An empty response is an anomaly — the server always sends five.
    expect(await screen.findByText("没有读到徽章")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain("还没有获得徽章");
  });
});

describe("AchievementBadgesPage — resilience", () => {
  it("renders an unknown badge instead of dropping it", async () => {
    mockedList.mockResolvedValue([
      ...FIVE,
      { id: "night-owl", title: "夜行者", description: "深夜创作", earned: false },
    ]);
    renderPage();
    const list = await screen.findByLabelText("徽章列表");
    expect(within(list).getByText("夜行者")).toBeInTheDocument();
    expect(screen.getByTestId("badge-unknown-note")).toBeInTheDocument();
  });

  it("shows a retryable error on a non-auth failure", async () => {
    mockedList.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("加载失败")).toBeInTheDocument();
    expect(document.body.textContent ?? "").toContain("无法读取你的徽章");
  });

  it("tells the user to log in when the session expired", async () => {
    const { ApiError } = await import("@/api/client");
    mockedList.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toBeInTheDocument();
  });
});

