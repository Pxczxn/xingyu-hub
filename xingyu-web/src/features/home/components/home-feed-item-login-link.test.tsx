import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ContentSummary } from "@/api/common.types";
import { HomeFeedItem } from "./HomeFeedItem";

/*
 * Guest like-count link (audit 2026-11-10).
 *
 * The row rendered `to="/login?redirect=/home"`: the query key is wrong
 * (`LoginPage` reads `returnTo`, so the value was ignored) AND `/home` is not a
 * route in this app. The link therefore always landed on "/" after login while
 * claiming to preserve the current page. It must be built with the shared
 * `buildLoginPath`, the same helper the discover/article/topic links use.
 */

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    like: vi.fn(),
    unlike: vi.fn(),
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
  },
}));

/* A guest payload: `liked` is undefined (nobody is signed in) but the server
 * still reports a like count, which is the branch that renders the login link. */
const ITEM: ContentSummary = {
  id: "a1",
  objectType: "ARTICLE",
  title: "一篇文章",
  likeCount: 3,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HomeFeedItem item={ITEM} />
    </MemoryRouter>,
  );
}

describe("HomeFeedItem — guest login link", () => {
  it("does not emit the non-existent redirect=/home", () => {
    renderAt("/");

    const link = screen.getByRole("link", { name: "3 次点赞" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("carries the current page as returnTo when the row is on a deep route", () => {
    renderAt("/topics/tech");

    expect(screen.getByRole("link", { name: "3 次点赞" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Ftopics%2Ftech",
    );
  });
});
