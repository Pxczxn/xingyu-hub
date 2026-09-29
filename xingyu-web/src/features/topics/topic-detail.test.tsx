import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicDetailPage } from "./pages/TopicDetailPage";

/*
 * Topic detail tests (Phase 1A): the :slug param drives loading, and
 * success / empty / error states are all covered.
 */

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    getTopics: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

const mocked = vi.mocked(topicsApi);

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/topics/${slug}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/topics/:slug" element={<TopicDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getTopicContent.mockResolvedValue([]);
});

describe("topic detail", () => {
  it("loads the topic identified by the :slug param", async () => {
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      description: "关于 Spring 的讨论",
      followerCount: 12,
      contentCount: 3,
    });

    renderAt("spring");

    await waitFor(() => {
      expect(mocked.getTopic).toHaveBeenCalledWith("spring");
    });
    expect(await screen.findByRole("heading", { name: "Spring 话题" })).toBeInTheDocument();
  });

  it("shows an empty state when the topic has no content", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "empty", name: "空话题" });
    mocked.getTopicContent.mockResolvedValue([]);

    renderAt("empty");

    await waitFor(() => {
      expect(screen.getByTestId("page-state-empty")).toBeInTheDocument();
    });
  });

  it("renders content returned by the topic content endpoint", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([
      { id: "c1", title: "一篇文章", objectType: "ARTICLE" },
    ]);

    renderAt("spring");

    await waitFor(() => {
      expect(screen.getByTestId("topic-content")).toBeInTheDocument();
    });
    expect(screen.getByText("一篇文章")).toBeInTheDocument();
  });

  it("shows an error state when the topic request fails", async () => {
    mocked.getTopic.mockRejectedValue(new Error("boom"));

    renderAt("broken");

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});
