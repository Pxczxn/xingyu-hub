import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
import { ApiError } from "@/api/client";
import { useAuth } from "@/features/auth/auth.store";
import { MomentDetailPage } from "./pages/MomentDetailPage";

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

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: vi.fn(),
}));

const mocked = vi.mocked(momentsApi);
const mockedAuth = vi.mocked(useAuth);

const VIEW = {
  id: "m-1",
  body: "今晚看见流星",
  authorId: "user-a",
  createdAt: new Date().toISOString(),
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

function renderDetail(id = "m-1") {
  return render(
    <MemoryRouter initialEntries={[`/moments/${id}`]}>
      <Routes>
        <Route path="/moments" element={<div data-testid="feed-page">动态列表</div>} />
        <Route path="/moments/:id" element={<MomentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  guestAuth();
});

describe("MomentDetailPage", () => {
  it("shows loading while the detail request is in flight", () => {
    mocked.getById.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("renders body and time without owner controls for a guest", async () => {
    mocked.getById.mockResolvedValue(VIEW);
    renderDetail();
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑动态" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除动态" })).not.toBeInTheDocument();
    expect(mocked.listMine).not.toHaveBeenCalled();
    expect(screen.queryByText("user-a")).not.toBeInTheDocument();
  });

  it("shows unavailable for 404", async () => {
    mocked.getById.mockRejectedValue(notFound());
    renderDetail();
    expect(await screen.findByText("动态不存在或已不可访问")).toBeInTheDocument();
    expect(screen.queryByText("你不是作者")).not.toBeInTheDocument();
  });

  it("shows a generic error for non-404 failures", async () => {
    mocked.getById.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderDetail();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("keeps public detail when listMine does not confirm ownership", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([{ ...VIEW, id: "other" }]);
    renderDetail();
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑动态" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除动态" })).not.toBeInTheDocument();
  });

  it("fails closed when listMine fails", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderDetail();
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑动态" })).not.toBeInTheDocument();
  });

  it("shows edit and delete when ownership is confirmed", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    renderDetail();
    expect(await screen.findByRole("button", { name: "编辑动态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除动态" })).toBeInTheDocument();
    expect(mocked.listMine).toHaveBeenCalledWith(1000);
  });

  it("ignores a stale detail response after the route param changes", async () => {
    guestAuth();
    let finishFirst: ((value: typeof VIEW) => void) | undefined;
    mocked.getById.mockImplementation((id: string) => {
      if (id === "m-a") {
        return new Promise((resolve) => {
          finishFirst = resolve;
        });
      }
      return Promise.resolve({ ...VIEW, id: "m-b", body: "第二条" });
    });
    render(
      <MemoryRouter initialEntries={["/moments/m-a"]}>
        <Routes>
          <Route
            path="/moments/:id"
            element={
              <>
                <Link to="/moments/m-b">go-b</Link>
                <MomentDetailPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    fireEvent.click(screen.getByText("go-b"));
    expect(await screen.findByText("第二条")).toBeInTheDocument();
    finishFirst?.({ ...VIEW, id: "m-a", body: "过期的第一条" });
    await waitFor(() => {
      expect(screen.queryByText("过期的第一条")).not.toBeInTheDocument();
    });
    expect(screen.getByText("第二条")).toBeInTheDocument();
  });

  it("enters inline edit and saves the server body", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.update.mockResolvedValue({ ...VIEW, body: "改过的流星" });
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "编辑动态" }));
    fireEvent.change(screen.getByLabelText("动态正文"), { target: { value: "改过的流星" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mocked.update).toHaveBeenCalledWith("m-1", { body: "改过的流星" });
    });
    expect(await screen.findByText("改过的流星")).toBeInTheDocument();
  });

  it("rejects blank edit without calling PATCH", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "编辑动态" }));
    fireEvent.change(screen.getByLabelText("动态正文"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mocked.update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("请填写动态正文");
  });

  it("prevents duplicate PATCH while pending", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.update.mockReturnValue(new Promise(() => {}));
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "编辑动态" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocked.update).toHaveBeenCalledTimes(1));
  });

  it("shows the edit-window conflict without replacing the body", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求冲突",
        status: 409,
        detail: "已超过可编辑时间窗口",
        code: "CONFLICT",
      }),
    );
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "编辑动态" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("已超过可编辑时间窗口")).toBeInTheDocument();
    expect(screen.getByText("今晚看见流星")).toBeInTheDocument();
  });

  it("treats a PATCH 404 as unavailable without leaking ownership", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.update.mockRejectedValue(notFound());
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "编辑动态" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("动态不存在或已不可访问")).toBeInTheDocument();
    expect(screen.queryByText("你不是作者")).not.toBeInTheDocument();
  });

  it("requires trash confirmation and replace-navigates to the feed", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.trash.mockResolvedValue(VIEW);
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "删除动态" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("确定删除这条动态吗？删除后将无法继续公开访问。");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(mocked.trash).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除动态" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(mocked.trash).toHaveBeenCalledWith("m-1"));
    expect(await screen.findByTestId("feed-page")).toBeInTheDocument();
    expect(screen.queryByText("今晚看见流星")).not.toBeInTheDocument();
  });

  it("does not send a second trash while pending", async () => {
    signedInAuth();
    mocked.getById.mockResolvedValue(VIEW);
    mocked.listMine.mockResolvedValue([VIEW]);
    mocked.trash.mockReturnValue(new Promise(() => {}));
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "删除动态" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(mocked.trash).toHaveBeenCalledTimes(1));
  });
});

