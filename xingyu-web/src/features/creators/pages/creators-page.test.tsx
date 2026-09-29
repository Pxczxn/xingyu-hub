import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicCreatorSummary, TopicSummary } from "@/api/topics/topics.types";
import { usersApi } from "@/api/users/users.api";
import { CreatorsPage } from "./CreatorsPage";
import { CREATOR_TOPIC_LIMIT } from "../creator-card";

/*
 * /creators (Phase 2K-1) — a pure front-end aggregation page.
 *
 * The behaviours worth pinning, in rough order of risk:
 *  1. the fan-out could accidentally become unbounded (topics limit);
 *  2. a per-topic or per-profile failure must DEGRADE, not fail the page —
 *     only GET /topics is load-bearing;
 *  3. follow state flips ONLY after the request succeeds (Legacy flipped first
 *     and left it flipped on failure);
 *  4. the follow button is absent when `following` is unknown — a wrong toggle
 *     is worse than no toggle.
 */

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: { getTopics: vi.fn(), getTopicCreators: vi.fn() },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

const mockedTopics = vi.mocked(topicsApi);
const mockedUsers = vi.mocked(usersApi);

function topic(id: string, name: string): TopicSummary {
  return { id, name, slug: name.toLowerCase() };
}

function creatorRow(username: string, contentCount = 1): TopicCreatorSummary {
  return { username, displayName: `${username} 的名字`, contentCount };
}

function profile(username: string, following?: boolean) {
  return { username, displayName: `${username} 档案名`, avatar: null, following };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CreatorsPage />
    </MemoryRouter>,
  );
}

/** Wire the happy path: every topic returns one creator, profiles resolve. */
function wireHappyPath() {
  mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
  mockedTopics.getTopicCreators.mockResolvedValue([creatorRow("alice")]);
  mockedUsers.getProfile.mockResolvedValue(profile("alice", false));
  mockedUsers.getUserWorks.mockResolvedValue({
    username: "alice",
    spaceSlug: "alice",
    owner: false,
    categories: [],
    works: [{ id: "w1", title: "第一篇" }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreatorsPage — loading and failure", () => {
  it("shows loading while GET /topics is in flight", () => {
    mockedTopics.getTopics.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("fails the page when GET /topics fails — there is nothing to aggregate from", async () => {
    mockedTopics.getTopics.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 500,
        detail: "",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.queryByLabelText("推荐作者列表")).not.toBeInTheDocument();
  });

  it("shows an empty state when the community has no topics", async () => {
    mockedTopics.getTopics.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无专题")).toBeInTheDocument();
  });
});

describe("CreatorsPage — fan-out boundaries", () => {
  it("queries at most CREATOR_TOPIC_LIMIT topics", async () => {
    // Forgetting this cap would make the page issue an unbounded number of requests.
    mockedTopics.getTopics.mockResolvedValue(
      Array.from({ length: CREATOR_TOPIC_LIMIT + 5 }, (_, i) => topic(`t${i}`, `专题${i}`)),
    );
    mockedTopics.getTopicCreators.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(mockedTopics.getTopicCreators).toHaveBeenCalledTimes(CREATOR_TOPIC_LIMIT),
    );
  });

  it("degrades a single failing topic to an empty list instead of failing the page", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语"), topic("t2", "写作")]);
    mockedTopics.getTopicCreators
      .mockRejectedValueOnce(
        new ApiError({
          type: "about:blank",
          title: "",
          status: 500,
          detail: "",
          code: "INTERNAL_ERROR",
        }),
      )
      .mockResolvedValueOnce([creatorRow("bob")]);
    mockedUsers.getProfile.mockResolvedValue(profile("bob", false));
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "bob",
      spaceSlug: "bob",
      owner: false,
      categories: [],
      works: [],
    });
    renderPage();

    expect(await screen.findByLabelText("推荐作者列表")).toBeInTheDocument();
    expect(screen.getByText("bob 档案名")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("still renders the card when the decorative profile fetch fails", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
    mockedTopics.getTopicCreators.mockResolvedValue([creatorRow("alice")]);
    mockedUsers.getProfile.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 500,
        detail: "",
        code: "INTERNAL_ERROR",
      }),
    );
    mockedUsers.getUserWorks.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 500,
        detail: "",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();

    const list = await screen.findByLabelText("推荐作者列表");
    // Falls back to the summary displayName and shows the explicit no-work note.
    expect(within(list).getByText("alice 的名字")).toBeInTheDocument();
    expect(screen.getByTestId("creator-no-work-alice")).toBeInTheDocument();
  });
});

describe("CreatorsPage — card content", () => {
  it("renders the merged card with display name, topic and work count", async () => {
    wireHappyPath();
    renderPage();

    const list = await screen.findByLabelText("推荐作者列表");
    expect(within(list).getByText("alice 档案名")).toBeInTheDocument();
    expect(within(list).getByText("星语")).toBeInTheDocument();
    expect(within(list).getByText("第一篇")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "查看主页" })).toHaveAttribute(
      "href",
      "/u/alice",
    );
  });

  it("links the latest work to its article page", async () => {
    wireHappyPath();
    renderPage();
    const list = await screen.findByLabelText("推荐作者列表");
    expect(within(list).getByRole("link", { name: /第一篇/ })).toHaveAttribute(
      "href",
      "/articles/w1",
    );
  });

  it("shows an explicit note when the creator has no public work", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
    mockedTopics.getTopicCreators.mockResolvedValue([creatorRow("alice")]);
    mockedUsers.getProfile.mockResolvedValue(profile("alice", false));
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "alice",
      spaceSlug: "alice",
      owner: false,
      categories: [],
      works: [],
    });
    renderPage();

    expect(await screen.findByTestId("creator-no-work-alice")).toBeInTheDocument();
  });

  it("states that the filter is scoped to the sampled topics, not the whole site", async () => {
    // The search box is client-side only; claiming otherwise would be a lie.
    wireHappyPath();
    renderPage();
    expect(await screen.findByTestId("creators-scope-note")).toHaveTextContent("不是全站搜索");
  });
});

describe("CreatorsPage — follow control", () => {
  it("does NOT render a follow button when `following` is unknown", async () => {
    // profile resolves but without a `following` field.
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
    mockedTopics.getTopicCreators.mockResolvedValue([creatorRow("alice")]);
    mockedUsers.getProfile.mockResolvedValue({ username: "alice", displayName: "alice 档案名" });
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "alice",
      spaceSlug: "alice",
      owner: false,
      categories: [],
      works: [],
    });
    renderPage();

    await screen.findByLabelText("推荐作者列表");
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
  });

  it("flips to 已关注 only AFTER the follow request resolves", async () => {
    wireHappyPath();
    let resolveFollow: (() => void) | undefined;
    mockedUsers.followUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFollow = resolve;
      }),
    );
    renderPage();

    const button = await screen.findByRole("button", { name: "关注" });
    fireEvent.click(button);

    // Still says 关注 while in flight — the server has not confirmed anything.
    await waitFor(() => expect(mockedUsers.followUser).toHaveBeenCalledWith("alice"));
    expect(screen.getByRole("button", { name: "关注" })).toBeInTheDocument();

    resolveFollow?.();
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
  });

  it("keeps the previous state and surfaces an error when follow fails", async () => {
    // Legacy flipped the button optimistically and left it flipped on failure.
    wireHappyPath();
    mockedUsers.followUser.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 401,
        detail: "",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "关注" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("关注操作未完成");
    // Crucially NOT flipped.
    expect(screen.getByRole("button", { name: "关注" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
  });

  it("calls unfollowUser when the creator is already followed", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
    mockedTopics.getTopicCreators.mockResolvedValue([creatorRow("alice")]);
    mockedUsers.getProfile.mockResolvedValue(profile("alice", true));
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "alice",
      spaceSlug: "alice",
      owner: false,
      categories: [],
      works: [],
    });
    mockedUsers.unfollowUser.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "已关注" }));

    await waitFor(() => expect(mockedUsers.unfollowUser).toHaveBeenCalledWith("alice"));
    expect(mockedUsers.followUser).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
  });

  it("clears a previous follow error on the next attempt", async () => {
    wireHappyPath();
    mockedUsers.followUser
      .mockRejectedValueOnce(
        new ApiError({
          type: "about:blank",
          title: "",
          status: 401,
          detail: "",
          code: "AUTH_REQUIRED",
        }),
      )
      .mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "关注" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关注" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("CreatorsPage — the two empty states are not the same", () => {
  /*
   * Verified against the live backend 2026-09-27: `listCreators` reads from
   * `article_topic` joined to PUBLISHED articles, and all 8 sampled topics
   * returned []. So "no creators at all" is the state real data hits today —
   * it must NOT be described as a filter problem.
   */
  it("explains that the topics have no published content when NOTHING was found", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语")]);
    mockedTopics.getTopicCreators.mockResolvedValue([]);
    renderPage();

    const empty = await screen.findByTestId("page-state-empty");
    expect(within(empty).getByText("暂无可推荐的作者")).toBeInTheDocument();
    expect(empty).toHaveTextContent("还没有已发布的内容");
    // Not the filter message.
    expect(empty).not.toHaveTextContent("调整专题或关键词后再试");
  });

  it("blames the filter when creators exist but the keyword excluded them", async () => {
    wireHappyPath();
    renderPage();
    await screen.findByLabelText("推荐作者列表");

    fireEvent.change(screen.getByLabelText("搜索作者"), { target: { value: "zzz" } });

    const empty = screen.getByTestId("page-state-empty");
    expect(within(empty).getByText("暂无匹配作者")).toBeInTheDocument();
    expect(empty).toHaveTextContent("调整专题或关键词后再试");
    expect(empty).not.toHaveTextContent("还没有已发布的内容");
  });

  it("blames the filter when a topic chip excludes the only creator", async () => {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语"), topic("t2", "写作")]);
    mockedTopics.getTopicCreators.mockImplementation(async (slug: string) =>
      slug === "星语" ? [creatorRow("alice")] : [],
    );
    mockedUsers.getProfile.mockResolvedValue(profile("alice", false));
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "alice",
      spaceSlug: "alice",
      owner: false,
      categories: [],
      works: [],
    });
    renderPage();
    await screen.findByLabelText("推荐作者列表");

    fireEvent.click(screen.getByRole("button", { name: "写作" }));

    const empty = screen.getByTestId("page-state-empty");
    expect(within(empty).getByText("暂无匹配作者")).toBeInTheDocument();
  });
});

describe("CreatorsPage — topic filter and search", () => {
  function wireTwoTopics() {
    mockedTopics.getTopics.mockResolvedValue([topic("t1", "星语"), topic("t2", "写作")]);
    mockedTopics.getTopicCreators.mockImplementation(async (slug: string) =>
      slug === "星语" ? [creatorRow("alice")] : [creatorRow("bob")],
    );
    mockedUsers.getProfile.mockImplementation(async (username: string) => profile(username, false));
    mockedUsers.getUserWorks.mockResolvedValue({
      username: "x",
      spaceSlug: "x",
      owner: false,
      categories: [],
      works: [],
    });
  }

  it("filters by topic chip", async () => {
    wireTwoTopics();
    renderPage();
    await screen.findByLabelText("推荐作者列表");

    fireEvent.click(screen.getByRole("button", { name: "写作" }));

    expect(screen.getByText("bob 档案名")).toBeInTheDocument();
    expect(screen.queryByText("alice 档案名")).not.toBeInTheDocument();
  });

  it("returns to the full list via 全部", async () => {
    wireTwoTopics();
    renderPage();
    await screen.findByLabelText("推荐作者列表");

    fireEvent.click(screen.getByRole("button", { name: "写作" }));
    fireEvent.click(screen.getByRole("button", { name: "全部" }));

    expect(screen.getByText("alice 档案名")).toBeInTheDocument();
    expect(screen.getByText("bob 档案名")).toBeInTheDocument();
  });

  it("filters by keyword and shows the empty state when nothing matches", async () => {
    wireTwoTopics();
    renderPage();
    await screen.findByLabelText("推荐作者列表");

    fireEvent.change(screen.getByLabelText("搜索作者"), { target: { value: "zzz" } });

    expect(screen.getByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.queryByLabelText("推荐作者列表")).not.toBeInTheDocument();
  });

  it("shows the topic chips from the sampled topics only", async () => {
    mockedTopics.getTopics.mockResolvedValue(
      Array.from({ length: CREATOR_TOPIC_LIMIT + 3 }, (_, i) => topic(`t${i}`, `专题${i}`)),
    );
    mockedTopics.getTopicCreators.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(mockedTopics.getTopicCreators).toHaveBeenCalled());
    // 全部 + sampled topics, and NOT the unsampled ones.
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "专题0" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `专题${CREATOR_TOPIC_LIMIT}` }),
    ).not.toBeInTheDocument();
  });
});
