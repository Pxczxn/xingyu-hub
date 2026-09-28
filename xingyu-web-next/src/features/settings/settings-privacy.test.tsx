import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { ApiError } from "@/api/client";
import { SettingsPrivacyPage } from "./pages/SettingsPrivacyPage";

/*
 * /settings/privacy behaviour: load, modify, save payload, error handling.
 *
 * The page renders exactly ONE privacy control (followersVisibility) because it
 * is the only one with a working contract. Dead preference keys are covered by
 * the "does not render dead keys" test below.
 */

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(),
    updateMyPrivacy: vi.fn(),
    updateMyProfile: vi.fn(),
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

const mocked = vi.mocked(usersApi);

function profile(overrides: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    username: "tester",
    displayName: "测试昵称",
    followersVisibility: "PRIVATE",
    lockVersion: 3,
    ...overrides,
  };
}

beforeEach(() => {
  mocked.getMyProfile.mockReset();
  mocked.updateMyPrivacy.mockReset();
});

describe("SettingsPrivacyPage — load", () => {
  it("reflects the stored followers visibility", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PUBLIC" }));

    render(<SettingsPrivacyPage />);

    expect(await screen.findByLabelText("公开")).toBeChecked();
    expect(screen.getByLabelText("仅自己")).not.toBeChecked();
  });

  it("defaults to private when the backend omits the field", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: undefined }));

    render(<SettingsPrivacyPage />);

    expect(await screen.findByLabelText("仅自己")).toBeChecked();
  });

  it("starts clean — save disabled until something changes", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());

    render(<SettingsPrivacyPage />);

    await screen.findByLabelText("仅自己");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("surfaces a load failure and offers a retry", async () => {
    mocked.getMyProfile.mockRejectedValueOnce(
      new ApiError({ type: "about:blank", title: "x", status: 500, detail: "boom", code: "INTERNAL_ERROR" }),
    );

    render(<SettingsPrivacyPage />);
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    mocked.getMyProfile.mockResolvedValueOnce(profile({ followersVisibility: "PUBLIC" }));
    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByLabelText("公开")).toBeChecked();
  });
});

describe("SettingsPrivacyPage — save", () => {
  it("sends the changed followers visibility", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PRIVATE" }));
    mocked.updateMyPrivacy.mockResolvedValue(profile({ followersVisibility: "PUBLIC" }));

    render(<SettingsPrivacyPage />);

    await userEvent.click(await screen.findByLabelText("公开"));
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mocked.updateMyPrivacy).toHaveBeenCalledWith({ followersVisibility: "PUBLIC" });
    });
    expect(await screen.findByTestId("privacy-saved")).toBeInTheDocument();
  });

  it("does not send a request when nothing changed", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PUBLIC" }));

    render(<SettingsPrivacyPage />);

    await screen.findByLabelText("公开");
    await userEvent.click(screen.getByLabelText("公开"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(mocked.updateMyPrivacy).not.toHaveBeenCalled();
  });

  it("refuses a no-op save even when the form is submitted directly", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PUBLIC" }));
    const { container } = render(<SettingsPrivacyPage />);

    await screen.findByLabelText("公开");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.queryByTestId("privacy-saved")).toBeNull());
    expect(mocked.updateMyPrivacy).not.toHaveBeenCalled();
  });

  it("keeps the selection and explains a save failure", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PRIVATE" }));
    mocked.updateMyPrivacy.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求参数无效",
        status: 400,
        detail: "followersVisibility: 可见性值无效",
        code: "VALIDATION_FAILED",
      }),
    );

    render(<SettingsPrivacyPage />);

    await userEvent.click(await screen.findByLabelText("公开"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const error = await screen.findByTestId("privacy-save-error");
    expect(error).toHaveTextContent("可见性值无效");
    // The user's choice survives the failure.
    expect(screen.getByLabelText("公开")).toBeChecked();
    expect(screen.queryByTestId("privacy-saved")).not.toBeInTheDocument();
  });

  it("clears a previous success badge when the value is edited again", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ followersVisibility: "PRIVATE" }));
    mocked.updateMyPrivacy.mockResolvedValue(profile({ followersVisibility: "PUBLIC" }));

    render(<SettingsPrivacyPage />);

    await userEvent.click(await screen.findByLabelText("公开"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByTestId("privacy-saved");

    await userEvent.click(screen.getByLabelText("仅自己"));
    expect(screen.queryByTestId("privacy-saved")).not.toBeInTheDocument();
  });
});

describe("SettingsPrivacyPage — no fake controls", () => {
  it("renders no dead preference keys and no unimplemented sections", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());

    render(<SettingsPrivacyPage />);
    await screen.findByLabelText("仅自己");

    // These have no working contract and must not be exposed as switches.
    expect(screen.queryByText(/搜索历史/)).not.toBeInTheDocument();
    expect(screen.queryByText(/个性化推荐/)).not.toBeInTheDocument();
    expect(screen.queryByText(/通知/)).not.toBeInTheDocument();
    expect(screen.queryByText(/修改密码/)).not.toBeInTheDocument();
    expect(screen.queryByText(/邮箱/)).not.toBeInTheDocument();
  });
});
