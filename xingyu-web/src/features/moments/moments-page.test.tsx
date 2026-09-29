import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
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

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: vi.fn(),
}));

const mocked = vi.mocked(momentsApi);
const mockedAuth = vi.mocked(useAuth);

const VIEW = {
  id: "m-1",
  body: "今晚看见流星",
  authorId: "user-a",
  createdAt: "2026-09-24T16:43:08Z",
};

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

  it("renders public feed body and time without fake author or interactions", async () => {
    mocked.list.mockResolvedValue([VIEW]);
    renderFeed();
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(document.querySelector(`time[datetime="${VIEW.createdAt}"]`)).toBeInTheDocument();
    expect(screen.queryByText("user-a")).not.toBeInTheDocument();
    expect(screen.queryByText("转发")).not.toBeInTheDocument();
    expect(screen.queryByText("浏览量")).not.toBeInTheDocument();
    expect(screen.queryByText("bookmark")).not.toBeInTheDocument();
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
    fireEvent.change(await screen.findByLabelText("动态正文"), { target: { value: "今晚看见流星" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    expect(await screen.findByTestId("detail-page")).toBeInTheDocument();
    expect(mocked.create).toHaveBeenCalledWith({ body: "今晚看见流星" });
  });
});

