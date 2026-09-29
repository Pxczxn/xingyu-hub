import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { onboardingApi } from "@/api/onboarding/onboarding.api";
import { usersApi } from "@/api/users/users.api";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";

vi.mock("@/api/onboarding/onboarding.api", () => ({
  onboardingApi: { get: vi.fn(), update: vi.fn() },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

const mockedOnboarding = vi.mocked(onboardingApi);
const mockedUsers = vi.mocked(usersApi);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-url">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(path = "/onboarding?returnTo=%2Fstudio") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/studio" element={<div>创作台</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUsers.getMyProfile.mockResolvedValue({
    username: "alice",
    displayName: "alice",
    bio: null,
    lockVersion: 0,
  });
});

describe("OnboardingPage", () => {
  it("starts from WELCOME and patches INTERESTS", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "WELCOME",
      interestsJson: null,
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: null,
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "欢迎来到星语" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始设置" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledWith({ step: "INTERESTS" });
    });
    expect(await screen.findByRole("heading", { name: "记录兴趣" })).toBeInTheDocument();
    expect(screen.queryByText("个性化推荐")).not.toBeInTheDocument();
  });

  it("allows leaving INTERESTS with zero interests and omits interestsJson", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: null,
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "FOLLOWS",
      interestsJson: null,
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledTimes(1);
    });
    expect(mockedOnboarding.update).toHaveBeenCalledWith({ step: "FOLLOWS" });
    const payload = mockedOnboarding.update.mock.calls[0][0];
    expect("interestsJson" in payload).toBe(false);
    expect(payload.interestsJson).toBeUndefined();
    expect(await screen.findByRole("heading", { name: "推荐关注" })).toBeInTheDocument();
  });

  it("does not send an empty interests array when skipping over saved interests", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: '["前端开发"]',
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "FOLLOWS",
      interestsJson: '["前端开发"]',
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "前端开发" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledTimes(1);
    });
    const payload = mockedOnboarding.update.mock.calls[0][0];
    expect(payload).toEqual({ step: "FOLLOWS" });
    expect(payload.interestsJson).toBeUndefined();
  });

  it("keeps saved interests when a step-only PATCH echoes interestsJson null", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "WELCOME",
      interestsJson: '["前端开发"]',
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: null,
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "开始设置" }));
    expect(await screen.findByRole("heading", { name: "记录兴趣" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前端开发" })).toHaveAttribute("aria-pressed", "true");
  });

  it("records interests as a JSON string and does not send null", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "INTERESTS",
      interestsJson: null,
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "FOLLOWS",
      interestsJson: '["前端开发"]',
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "前端开发" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledWith({
        step: "FOLLOWS",
        interestsJson: '["前端开发"]',
      });
    });
    const payload = mockedOnboarding.update.mock.calls[0][0];
    expect(payload.interestsJson).not.toBeNull();
  });

  it("reuses usersApi for PROFILE and omits empty bio", async () => {
    mockedOnboarding.get
      .mockResolvedValueOnce({
        step: "PROFILE",
        interestsJson: '["写作"]',
        completed: false,
      })
      .mockResolvedValueOnce({
        step: "PROFILE",
        interestsJson: '["写作"]',
        completed: true,
      });
    mockedUsers.updateMyProfile.mockResolvedValue({
      username: "alice",
      displayName: "探针昵称",
      bio: null,
      lockVersion: 1,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "PROFILE",
      interestsJson: '["写作"]',
      completed: true,
    });
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText("展示名称");
    await waitFor(() => expect(name).toHaveValue("alice"));
    await user.clear(name);
    await user.type(name, "探针昵称");
    await user.click(screen.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(mockedUsers.updateMyProfile).toHaveBeenCalledWith({
        lockVersion: 0,
        displayName: "探针昵称",
      });
    });
    expect(mockedOnboarding.update).toHaveBeenCalledWith({ completed: true });
    expect(mockedUsers.followUser).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/studio");
    });
  });

  it("renders FOLLOWS as skippable degraded state and never fetches suggestions", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "FOLLOWS",
      interestsJson: '["写作"]',
      completed: false,
    });
    mockedOnboarding.update.mockResolvedValue({
      step: "PROFILE",
      interestsJson: '["写作"]',
      completed: false,
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/创作者推荐暂时不可用/)).toBeInTheDocument();
    expect(mockedUsers.followUser).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "跳过" }));
    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledWith({ step: "PROFILE" });
    });
    expect(await screen.findByRole("heading", { name: "完善资料" })).toBeInTheDocument();
  });

  it("resumes the FOLLOWS panel from a stored FOLLOWS step", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "FOLLOWS",
      interestsJson: '["写作"]',
      completed: false,
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "推荐关注" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "完善资料" })).not.toBeInTheDocument();
    expect(mockedOnboarding.update).not.toHaveBeenCalled();
  });

  it("resumes the PROFILE panel from a stored PROFILE step", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "PROFILE",
      interestsJson: '["写作"]',
      completed: false,
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "完善资料" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "推荐关注" })).not.toBeInTheDocument();
    expect(mockedOnboarding.update).not.toHaveBeenCalled();
  });

  it("persists completed=true then returns to the stored returnTo", async () => {
    mockedOnboarding.get
      .mockResolvedValueOnce({
        step: "DONE",
        interestsJson: '["写作"]',
        completed: false,
      })
      .mockResolvedValueOnce({
        step: "DONE",
        interestsJson: '["写作"]',
        completed: true,
      });
    mockedOnboarding.update.mockResolvedValue({
      step: "DONE",
      interestsJson: '["写作"]',
      completed: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "进入星语" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledWith({ completed: true });
    });
    expect(mockedOnboarding.get).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/studio");
    });
  });

  it("double-submitting WELCOME only sends one PATCH", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "WELCOME",
      interestsJson: null,
      completed: false,
    });
    let resolveUpdate!: (value: {
      step: string;
      interestsJson: string | null;
      completed: boolean;
    }) => void;
    mockedOnboarding.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();

    const start = await screen.findByRole("button", { name: "开始设置" });
    await user.click(start);
    await user.click(start);
    expect(mockedOnboarding.update).toHaveBeenCalledTimes(1);
    resolveUpdate({ step: "INTERESTS", interestsJson: null, completed: false });
    expect(await screen.findByRole("heading", { name: "记录兴趣" })).toBeInTheDocument();
  });

  it("does not PATCH profile when profile GET failed, but still completes", async () => {
    mockedOnboarding.get
      .mockResolvedValueOnce({
        step: "PROFILE",
        interestsJson: '["写作"]',
        completed: false,
      })
      .mockResolvedValueOnce({
        step: "PROFILE",
        interestsJson: '["写作"]',
        completed: true,
      });
    mockedUsers.getMyProfile.mockRejectedValue(new Error("profile down"));
    mockedOnboarding.update.mockResolvedValue({
      step: "PROFILE",
      interestsJson: '["写作"]',
      completed: true,
    });
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText("展示名称");
    await user.type(name, "探针昵称");
    await user.click(screen.getByRole("button", { name: "下一步" }));

    await waitFor(() => {
      expect(mockedOnboarding.update).toHaveBeenCalledWith({ completed: true });
    });
    expect(mockedUsers.updateMyProfile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/studio");
    });
  });

  it("shows a reload action when the onboarding step is unknown", async () => {
    mockedOnboarding.get
      .mockResolvedValueOnce({
        step: "LEGACY_UNKNOWN",
        interestsJson: null,
        completed: false,
      })
      .mockResolvedValueOnce({
        step: "WELCOME",
        interestsJson: null,
        completed: false,
      });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "入门状态异常" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始设置" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新读取" }));
    expect(await screen.findByRole("heading", { name: "欢迎来到星语" })).toBeInTheDocument();
    expect(mockedOnboarding.get).toHaveBeenCalledTimes(2);
    expect(mockedOnboarding.update).not.toHaveBeenCalled();
  });
});

