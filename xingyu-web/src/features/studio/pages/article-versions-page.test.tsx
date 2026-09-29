import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleRevision } from "@/api/articles/articles.types";
import { ArticleVersionsPage } from "./ArticleVersionsPage";

/*
 * /studio/content/:articleId/versions (Phase 2L).
 *
 * The behaviours pinned here are the ones that differ from Legacy on purpose:
 *
 *  - rows are described as PUBLISHED versions, never as 「自动保存」 (Legacy lied
 *    about this — formal revisions are written on publish);
 *  - an empty history is a NORMAL state that explains itself, not an error;
 *  - the restore control is offered only when the backend would accept it
 *    (canEditDraft: PUBLISHED or DRAFT, NOT IN_REVIEW), and when it is withheld
 *    the page says WHY instead of silently omitting it;
 *  - a 409 keeps the page usable and reports the server's own message;
 *  - the preview does not pretend to show a body the endpoint never returns.
 */

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listRevisions: vi.fn(),
    getMyArticleStatus: vi.fn(),
    restoreRevision: vi.fn(),
    listMine: vi.fn(),
  },
}));

const mocked = vi.mocked(articlesApi);

function revision(overrides: Partial<ArticleRevision> = {}): ArticleRevision {
  return {
    id: "r1",
    revisionNumber: 3,
    title: "第一次发布",
    summary: "这是当时的摘要",
    visibility: "PUBLIC",
    frozenAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage(articleId = "a1") {
  return render(
    <MemoryRouter initialEntries={[`/studio/content/${articleId}/versions`]}>
      <Routes>
        <Route path="/studio/content/:articleId/versions" element={<ArticleVersionsPage />} />
        <Route path="/studio/content/:articleId" element={<p>编辑器</p>} />
        <Route path="/studio/submissions" element={<p>投稿列表</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function problem(status: number, code: string, detail = "") {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getMyArticleStatus.mockResolvedValue("PUBLISHED");
});

/*
 * The selected revision's title/visibility appear BOTH in the rail and in the
 * detail panel, so a bare getByText would match two nodes. Scope every list
 * assertion to the rail.
 */
async function list() {
  return within(await screen.findByLabelText("版本列表"));
}

describe("article versions page", () => {
  it("lists the revisions with published-version wording", async () => {
    mocked.listRevisions.mockResolvedValue([revision()]);
    renderPage();

    const rail = await list();
    expect(rail.getByText("第一次发布")).toBeInTheDocument();
    expect(rail.getByText(/发布版本/)).toBeInTheDocument();
  });

  it("NEVER labels the history as auto-saves", async () => {
    // The central correction over Legacy, which called these 「自动保存」 and
    // claimed a snapshot every 3 minutes. Formal revisions are publish-time only.
    mocked.listRevisions.mockResolvedValue([revision()]);
    renderPage();
    await list();

    const body = document.body.textContent ?? "";
    expect(body).not.toContain("自动保存");
    expect(body).not.toContain("每 3 分钟");
  });

  it("shows the frozen summary and visibility of the selected revision", async () => {
    mocked.listRevisions.mockResolvedValue([revision()]);
    renderPage();

    expect(await screen.findByText("这是当时的摘要")).toBeInTheDocument();
    // Visibility renders in both rail and panel — assert presence, not count.
    expect(screen.getAllByText(/公开/).length).toBeGreaterThan(0);
  });

  it("says the body is NOT previewed rather than faking one", async () => {
    mocked.listRevisions.mockResolvedValue([revision()]);
    renderPage();

    expect(await screen.findByText(/正文不会在这里提供预览/)).toBeInTheDocument();
  });

  describe("empty history", () => {
    beforeEach(() => {
      mocked.listRevisions.mockResolvedValue([]);
    });

    it("treats an empty history as a normal state, not an error", async () => {
      renderPage();

      expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
    });

    it("explains that versions are created on publish", async () => {
      renderPage();

      const empty = await screen.findByTestId("page-state-empty");
      expect(empty).toHaveTextContent("发布");
    });
  });

  describe("restore gating", () => {
    it("offers restore for a PUBLISHED article", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.getMyArticleStatus.mockResolvedValue("PUBLISHED");
      renderPage();

      expect(await screen.findByRole("button", { name: "恢复为当前草稿" })).toBeInTheDocument();
      expect(screen.queryByTestId("restore-blocked")).not.toBeInTheDocument();
    });

    it("offers restore for a DRAFT article", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.getMyArticleStatus.mockResolvedValue("DRAFT");
      renderPage();

      expect(await screen.findByRole("button", { name: "恢复为当前草稿" })).toBeInTheDocument();
    });

    it("hides restore for an IN_REVIEW article and explains why", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.getMyArticleStatus.mockResolvedValue("IN_REVIEW");
      renderPage();

      expect(await screen.findByTestId("restore-blocked")).toBeInTheDocument();
      expect(screen.getByTestId("restore-blocked")).toHaveTextContent("审核");
      expect(screen.queryByRole("button", { name: "恢复为当前草稿" })).not.toBeInTheDocument();
    });

    it("hides restore when the status cannot be resolved", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.getMyArticleStatus.mockResolvedValue(null);
      renderPage();

      expect(await screen.findByTestId("restore-blocked")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "恢复为当前草稿" })).not.toBeInTheDocument();
    });

    it("still renders the history when the status lookup fails", async () => {
      // Status is decoration for the gate only — losing it must not blank the page.
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.getMyArticleStatus.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
      renderPage();

      const rail = await list();
      expect(rail.getByText("第一次发布")).toBeInTheDocument();
      expect(screen.getByTestId("restore-blocked")).toBeInTheDocument();
    });
  });

  describe("restoring", () => {
    it("asks for confirmation before overwriting the draft", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "恢复为当前草稿" }));

      const dialog = screen.getByRole("alertdialog", { name: "确认恢复版本" });
      expect(dialog).toHaveTextContent("当前草稿的内容会被覆盖");
      expect(mocked.restoreRevision).not.toHaveBeenCalled();
    });

    it("restores the SELECTED revision, not the first row", async () => {
      mocked.listRevisions.mockResolvedValue([
        revision({ id: "r1", title: "第一次发布" }),
        revision({ id: "r2", title: "第二次发布", revisionNumber: 4 }),
      ]);
      mocked.restoreRevision.mockResolvedValue({} as never);
      renderPage();

      // Wait for the rail, then click the SECOND row specifically.
      const rail = await list();
      fireEvent.click(rail.getByRole("button", { name: /第二次发布/ }));
      fireEvent.click(screen.getByRole("button", { name: "恢复为当前草稿" }));
      fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));

      await waitFor(() => {
        expect(mocked.restoreRevision).toHaveBeenCalledWith("a1", "r2");
      });
    });

    it("confirms success and points back to the editor", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.restoreRevision.mockResolvedValue({} as never);
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "恢复为当前草稿" }));
      fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));

      expect(await screen.findByText(/已恢复为当前草稿/)).toBeInTheDocument();
    });

    it("surfaces the server's detail on a 409 and keeps the page usable", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.restoreRevision.mockRejectedValue(problem(409, "CONFLICT", "文章当前不可恢复版本"));
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "恢复为当前草稿" }));
      fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("文章当前不可恢复版本");
      // The user must be able to try again — the dialog closes.
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("falls back to generic copy when the server sends no detail", async () => {
      // Guards the exact class of bug found in Phase 2K-2: setState(undefined)
      // is a no-op, so a missing `detail` would silently render no alert at all.
      mocked.listRevisions.mockResolvedValue([revision()]);
      mocked.restoreRevision.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "恢复为当前草稿" }));
      fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("恢复版本失败");
    });

    it("does not fire twice while a restore is in flight", async () => {
      mocked.listRevisions.mockResolvedValue([revision()]);
      let release: (value: unknown) => void = () => {};
      mocked.restoreRevision.mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }) as never,
      );
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "恢复为当前草稿" }));
      const confirm = screen.getByRole("button", { name: "确认恢复" });
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      release({});
      await waitFor(() => expect(mocked.restoreRevision).toHaveBeenCalledTimes(1));
    });
  });

  describe("unavailable", () => {
    it("shows a not-found state on 404", async () => {
      mocked.listRevisions.mockRejectedValue(problem(404, "NOT_FOUND"));
      renderPage();

      expect(await screen.findByText("文章不存在或无权查看")).toBeInTheDocument();
    });

    it("shows an error state on a non-404 failure", async () => {
      mocked.listRevisions.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
      renderPage();

      expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});
