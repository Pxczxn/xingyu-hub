import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { creationSpaceApi } from "@/api/creation-space/creation-space.api";
import type { CreationSpaceCategory } from "@/api/creation-space/creation-space.types";
import { StudioCategoriesPage } from "./StudioCategoriesPage";

/*
 * /studio/categories (Phase 2N).
 *
 * The behaviour that matters is the distinction the backend actually draws:
 * ARCHIVE is a status update, DELETE really removes the row. A page that blurs
 * them (or that offers a "retry" after a 409 that cannot succeed) is worse than
 * no page, so those are pinned here.
 */

vi.mock("@/api/creation-space/creation-space.api", () => ({
  creationSpaceApi: {
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ user: { email: "tester@pxczxn.top", username: "tester" } }),
}));

const mockedApi = vi.mocked(creationSpaceApi);

function category(overrides: Partial<CreationSpaceCategory> = {}): CreationSpaceCategory {
  return {
    id: "c1",
    name: "散文",
    slug: "essay",
    status: "ACTIVE",
    lockVersion: 0,
    sortOrder: 0,
    ...overrides,
  };
}

function apiError(status: number, detail: string): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code: "X" });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/studio/categories"]}>
      <Routes>
        <Route path="/studio/categories" element={<StudioCategoriesPage />} />
        <Route path="/studio" element={<p>创作中心</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.listCategories.mockResolvedValue([category()]);
});

describe("studio categories page", () => {
  it("renders the list", async () => {
    renderPage();
    const list = await screen.findByLabelText("分类列表");
    expect(list).toHaveTextContent("散文");
    expect(list).toHaveTextContent("essay");
  });

  it("shows a loading state first", () => {
    mockedApi.listCategories.mockReturnValue(new Promise(() => {}) as never);
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("reports a load failure as an error", async () => {
    mockedApi.listCategories.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toHaveTextContent("无法读取");
  });

  it("distinguishes 'no creation space' from 'no categories'", async () => {
    // The API 404s when the viewer has no creation space. That is a missing
    // precondition, not an empty list — showing the empty state would be a lie.
    mockedApi.listCategories.mockRejectedValue(apiError(404, "创作空间不存在"));
    renderPage();
    const empty = await screen.findByTestId("page-state-empty");
    expect(empty).toHaveTextContent("创作空间尚未建立");
    expect(empty).not.toHaveTextContent("还没有分类");
  });

  it("labels the two statuses in Chinese", async () => {
    mockedApi.listCategories.mockResolvedValue([
      category({ id: "a", status: "ACTIVE" }),
      category({ id: "b", status: "ARCHIVED" }),
    ]);
    renderPage();
    await screen.findByLabelText("分类列表");
    expect(screen.getByTestId("category-status-a")).toHaveTextContent("使用中");
    expect(screen.getByTestId("category-status-b")).toHaveTextContent("已归档");
  });

  it("puts archived rows at the bottom", async () => {
    mockedApi.listCategories.mockResolvedValue([
      category({ id: "a", name: "归档的", status: "ARCHIVED" }),
      category({ id: "b", name: "在用的", status: "ACTIVE" }),
    ]);
    renderPage();
    const list = await screen.findByLabelText("分类列表");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("在用的");
    expect(items[1]).toHaveTextContent("归档的");
  });

  describe("create", () => {
    it("creates a category with the derived slug previewed", async () => {
      mockedApi.createCategory.mockResolvedValue(category());
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.change(screen.getByTestId("category-name"), { target: { value: "My Essay" } });

      // The preview must show the real V2 profile path, not a made-up one.
      expect(screen.getByTestId("category-slug-preview")).toHaveTextContent(
        "/u/tester/works/my-essay",
      );

      fireEvent.click(screen.getByTestId("category-create"));

      await waitFor(() => {
        expect(mockedApi.createCategory).toHaveBeenCalledWith({ name: "My Essay", slug: "my-essay" });
      });
    });

    it("refuses a blank name without calling the API", async () => {
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.change(screen.getByTestId("category-name"), { target: { value: "   " } });
      fireEvent.click(screen.getByTestId("category-create"));

      expect(await screen.findByTestId("category-create-error")).toHaveTextContent("不能为空");
      expect(mockedApi.createCategory).not.toHaveBeenCalled();
    });

    it("surfaces the server's own slug-conflict sentence", async () => {
      mockedApi.createCategory.mockRejectedValue(apiError(422, "别名已被占用"));
      renderPage();
      await screen.findByLabelText("分类列表");

      // The name must derive a slug that passes LOCAL validation, otherwise the
      // local check short-circuits and we never reach the server. (A CJK name
      // like "散文" derives "散文", which fails the slug pattern — correct local
      // behaviour, but it means this test would prove nothing about the server
      // path.)
      fireEvent.change(screen.getByTestId("category-name"), { target: { value: "Prose" } });
      fireEvent.click(screen.getByTestId("category-create"));

      expect(await screen.findByTestId("category-create-error")).toHaveTextContent("别名已被占用");
    });

    it("blocks a CJK-derived slug locally, before any request", async () => {
      // The server's pattern is [a-z0-9-]; a CJK name cannot produce a legal
      // slug. Rejecting it locally is the point of mirroring the rule.
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.change(screen.getByTestId("category-name"), { target: { value: "散文" } });
      fireEvent.click(screen.getByTestId("category-create"));

      expect(await screen.findByTestId("category-create-error")).toHaveTextContent("小写字母");
      expect(mockedApi.createCategory).not.toHaveBeenCalled();
    });
  });

  describe("rename", () => {
    it("sends lockVersion, not just the new name", async () => {
      mockedApi.listCategories.mockResolvedValue([category({ id: "c1", lockVersion: 5 })]);
      mockedApi.updateCategory.mockResolvedValue(category());
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.click(screen.getByTestId("category-rename-c1"));
      fireEvent.change(screen.getByTestId("category-rename-input-c1"), {
        target: { value: "随笔" },
      });
      fireEvent.click(screen.getByTestId("category-rename-save-c1"));

      await waitFor(() => {
        expect(mockedApi.updateCategory).toHaveBeenCalledWith("c1", {
          lockVersion: 5,
          name: "随笔",
        });
      });
    });

    it("reloads on a 409 instead of inviting a doomed retry", async () => {
      mockedApi.updateCategory.mockRejectedValue(apiError(409, "分类已被他人更新"));
      renderPage();
      await screen.findByLabelText("分类列表");
      const callsBefore = mockedApi.listCategories.mock.calls.length;

      fireEvent.click(screen.getByTestId("category-rename-c1"));
      fireEvent.change(screen.getByTestId("category-rename-input-c1"), {
        target: { value: "随笔" },
      });
      fireEvent.click(screen.getByTestId("category-rename-save-c1"));

      expect(await screen.findByTestId("category-row-error")).toHaveTextContent("已被他人更新");
      await waitFor(() => {
        expect(mockedApi.listCategories.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });

  describe("archive versus delete", () => {
    it("archives via a status update, not a delete", async () => {
      mockedApi.listCategories.mockResolvedValue([category({ id: "c1", lockVersion: 2 })]);
      mockedApi.updateCategory.mockResolvedValue(category({ status: "ARCHIVED" }));
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.click(screen.getByTestId("category-archive-c1"));

      await waitFor(() => {
        expect(mockedApi.updateCategory).toHaveBeenCalledWith("c1", {
          lockVersion: 2,
          status: "ARCHIVED",
        });
      });
      expect(mockedApi.deleteCategory).not.toHaveBeenCalled();
    });

    it("offers 取消归档 on an archived row", async () => {
      mockedApi.listCategories.mockResolvedValue([category({ id: "c1", status: "ARCHIVED" })]);
      mockedApi.updateCategory.mockResolvedValue(category());
      renderPage();
      await screen.findByLabelText("分类列表");

      expect(screen.queryByTestId("category-archive-c1")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("category-restore-c1"));

      await waitFor(() => {
        expect(mockedApi.updateCategory).toHaveBeenCalledWith("c1", {
          lockVersion: 0,
          status: "ACTIVE",
        });
      });
    });

    it("asks for confirmation before deleting, and says it is irreversible", async () => {
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.click(screen.getByTestId("category-delete-c1"));

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("无法撤销");
      // Points at archive as the non-destructive alternative.
      expect(dialog).toHaveTextContent("归档");
      expect(mockedApi.deleteCategory).not.toHaveBeenCalled();
    });

    it("does not delete when the confirmation is cancelled", async () => {
      renderPage();
      await screen.findByLabelText("分类列表");

      fireEvent.click(screen.getByTestId("category-delete-c1"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByTestId("category-delete-cancel-c1"));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(mockedApi.deleteCategory).not.toHaveBeenCalled();
    });

    it("deletes after confirmation", async () => {
      mockedApi.deleteCategory.mockResolvedValue(undefined);
      renderPage();
      await screen.findByLabelText("分类列表");
      mockedApi.listCategories.mockResolvedValue([]);

      fireEvent.click(screen.getByTestId("category-delete-c1"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByTestId("category-delete-confirm-c1"));

      await waitFor(() => {
        expect(mockedApi.deleteCategory).toHaveBeenCalledWith("c1");
      });
    });
  });

  it("shows the empty state when the space has no categories", async () => {
    mockedApi.listCategories.mockResolvedValue([]);
    renderPage();
    const empty = await screen.findByTestId("page-state-empty");
    expect(empty).toHaveTextContent("还没有分类");
  });

  it("notes how many are archived when any are", async () => {
    mockedApi.listCategories.mockResolvedValue([
      category({ id: "a", status: "ARCHIVED" }),
      category({ id: "b", status: "ACTIVE" }),
    ]);
    renderPage();
    await screen.findByLabelText("分类列表");
    expect(screen.getByTestId("category-archived-note")).toHaveTextContent("1 条已归档");
  });

  it("offers no reorder control — sortOrder is not writable", async () => {
    renderPage();
    await screen.findByLabelText("分类列表");
    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((b) => (b.textContent ?? "").trim());
    for (const label of labels) {
      expect(label).not.toMatch(/上移|下移|置顶|排序|拖动/);
    }
  });

  it("does not offer to rename the slug — nothing surfaces it yet", async () => {
    renderPage();
    await screen.findByLabelText("分类列表");
    const buttons = screen.getAllByRole("button").map((b) => (b.textContent ?? "").trim());
    expect(buttons.some((l) => l.includes("别名"))).toBe(false);
  });
});
