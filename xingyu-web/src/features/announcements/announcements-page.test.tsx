import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import { ApiError } from "@/api/client";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { AnnouncementDetailPage } from "./pages/AnnouncementDetailPage";

vi.mock("@/api/announcements/announcements.api", () => ({
  announcementsApi: { list: vi.fn(), getById: vi.fn() },
}));

const mocked = vi.mocked(announcementsApi);

const ITEM = {
  id: "ann-1",
  title: "维护通知",
  body: "今晚维护",
  publishedAt: "2026-09-18T20:33:57Z",
};

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function genericError(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "系统繁忙，请稍后再试",
    status: 500,
    detail: "系统繁忙，请稍后再试",
    code: "INTERNAL_ERROR",
  });
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/announcements"]}>
      <Routes>
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/announcements/${id}`]}>
      <Routes>
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnnouncementsPage", () => {
  it("shows loading while the list request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("treats an empty array as 暂无已发布公告, not a failure", async () => {
    mocked.list.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("暂无已发布公告")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
    expect(screen.queryByText("置顶")).not.toBeInTheDocument();
  });

  it("renders published items and navigates to the detail route", async () => {
    mocked.list.mockResolvedValue([ITEM]);
    mocked.getById.mockResolvedValue(ITEM);
    renderList();

    const link = await screen.findByRole("link", { name: /维护通知/ });
    expect(link).toHaveAttribute("href", "/announcements/ann-1");
    expect(screen.queryByText("置顶")).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(await screen.findByText("今晚维护")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "维护通知" })).toBeInTheDocument();
  });

  it("shows a list error state when the request fails", async () => {
    mocked.list.mockRejectedValue(genericError());
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

describe("AnnouncementDetailPage", () => {
  it("shows loading then the announcement body", async () => {
    mocked.getById.mockResolvedValue(ITEM);
    renderDetail("ann-1");
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "维护通知" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回公告列表" })).toHaveAttribute(
      "href",
      "/announcements",
    );
  });

  it("shows a resource-unavailable state for 404", async () => {
    mocked.getById.mockRejectedValue(notFound());
    renderDetail("missing");
    expect(await screen.findByText("公告不存在或未发布")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回公告列表" })).toBeInTheDocument();
  });

  it("shows a generic error for non-404 failures", async () => {
    mocked.getById.mockRejectedValue(genericError());
    renderDetail("ann-1");
    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
    expect(screen.queryByText("公告不存在或未发布")).not.toBeInTheDocument();
  });
});
