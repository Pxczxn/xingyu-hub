import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { ApiError } from "@/api/client";
import { SettingsProfilePage } from "./pages/SettingsProfilePage";

/*
 * /settings/profile behaviour: load, edit, explicit save, payload shape,
 * failure-keeps-input, post-save adoption ("reload"), and the cannot-clear guard.
 *
 * The cannot-clear guard is not a nicety: the backend returns 200 for a blanked
 * field while keeping the old value (verified live 2026-09-22 — see
 * settings-form.ts), so submitting one would be a fake success.
 */

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    updateMyPrivacy: vi.fn(),
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
    bio: "一段简介",
    websiteUrl: "https://example.com",
    visibility: "PUBLIC",
    followersVisibility: "PRIVATE",
    lockVersion: 3,
    ...overrides,
  };
}

function apiError(status: number, detail: string, code = "CONFLICT"): ApiError {
  return new ApiError({ type: "about:blank", title: "请求失败", status, detail, code });
}

beforeEach(() => {
  mocked.getMyProfile.mockReset();
  mocked.updateMyProfile.mockReset();
});

describe("SettingsProfilePage — load", () => {
  it("renders the loaded profile values", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());

    render(<SettingsProfilePage />);

    expect(await screen.findByLabelText("昵称")).toHaveValue("测试昵称");
    expect(screen.getByLabelText("简介")).toHaveValue("一段简介");
    expect(screen.getByLabelText("个人网站")).toHaveValue("https://example.com");
    expect(screen.getByLabelText("公开")).toBeChecked();
    expect(screen.getByLabelText("不列出")).not.toBeChecked();
  });

  it("shows the username read-only (renaming is not part of this round)", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());

    render(<SettingsProfilePage />);

    const username = await screen.findByLabelText("用户名");
    expect(username).toHaveValue("tester");
    expect(username).toBeDisabled();
  });

  it("surfaces a load failure and offers a retry", async () => {
    mocked.getMyProfile.mockRejectedValueOnce(apiError(500, "boom", "INTERNAL_ERROR"));

    render(<SettingsProfilePage />);

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    mocked.getMyProfile.mockResolvedValueOnce(profile());
    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByLabelText("昵称")).toHaveValue("测试昵称");
  });

  it("starts clean — no dirty hint, save disabled", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());

    render(<SettingsProfilePage />);

    await screen.findByLabelText("昵称");
    expect(screen.queryByTestId("profile-dirty")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });
});

describe("SettingsProfilePage — edit and save", () => {
  it("marks the form dirty once a field changes", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "新昵称");

    expect(screen.getByTestId("profile-dirty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("sends ONLY the changed field plus lockVersion", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockResolvedValue(profile({ displayName: "新昵称", lockVersion: 4 }));

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "新昵称");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mocked.updateMyProfile).toHaveBeenCalledWith({
        lockVersion: 3,
        displayName: "新昵称",
      });
    });
  });

  it("does not include untouched fields in the payload", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockResolvedValue(profile({ visibility: "UNLISTED", lockVersion: 4 }));

    render(<SettingsProfilePage />);

    await userEvent.click(await screen.findByLabelText("不列出"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mocked.updateMyProfile).toHaveBeenCalledWith({
        lockVersion: 3,
        visibility: "UNLISTED",
      });
    });
  });

  it("shows a saved confirmation and adopts the server response", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockResolvedValue(profile({ displayName: "服务端昵称", lockVersion: 4 }));

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "新昵称");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByTestId("profile-saved")).toBeInTheDocument();
    expect(screen.getByLabelText("昵称")).toHaveValue("服务端昵称");
    // Saved means clean again.
    expect(screen.queryByTestId("profile-dirty")).not.toBeInTheDocument();
  });

  it("keeps the user's input when the save fails", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockRejectedValue(apiError(500, "系统繁忙", "INTERNAL_ERROR"));

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "我辛苦打的字");

    const bio = screen.getByLabelText("简介");
    await userEvent.clear(bio);
    await userEvent.type(bio, "我辛苦写的简介");

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByTestId("profile-save-error")).toBeInTheDocument();
    // The critical guarantee: nothing was re-fetched over the user's edits.
    expect(screen.getByLabelText("昵称")).toHaveValue("我辛苦打的字");
    expect(screen.getByLabelText("简介")).toHaveValue("我辛苦写的简介");
    expect(screen.getByTestId("profile-dirty")).toBeInTheDocument();
    expect(mocked.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it("explains a 409 conflict and offers a manual reload", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockRejectedValue(apiError(409, "资料已被他人更新，请刷新后重试"));

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "并发改名");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const error = await screen.findByTestId("profile-save-error");
    expect(error).toHaveTextContent("资料已被其他会话更新");
    // Input is preserved and the reload is explicit, never automatic.
    expect(screen.getByLabelText("昵称")).toHaveValue("并发改名");
    expect(mocked.getMyProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("re-reads the profile after an explicit reload", async () => {
    mocked.getMyProfile.mockResolvedValueOnce(profile());
    mocked.updateMyProfile.mockRejectedValueOnce(apiError(409, "conflict"));

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "并发改名");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    mocked.getMyProfile.mockResolvedValueOnce(profile({ displayName: "别人改后的昵称" }));
    await userEvent.click(await screen.findByRole("button", { name: "重新加载" }));

    expect(await screen.findByLabelText("昵称")).toHaveValue("别人改后的昵称");
  });

  it("persists across a remount (the reload path)", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    mocked.updateMyProfile.mockResolvedValue(profile({ displayName: "已保存昵称", lockVersion: 4 }));

    const view = render(<SettingsProfilePage />);
    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "已保存昵称");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByTestId("profile-saved");

    // Remount = a fresh page load; the server now returns the saved value.
    view.unmount();
    mocked.getMyProfile.mockResolvedValue(profile({ displayName: "已保存昵称", lockVersion: 4 }));
    render(<SettingsProfilePage />);

    expect(await screen.findByLabelText("昵称")).toHaveValue("已保存昵称");
  });
});

describe("SettingsProfilePage — cannot-clear guard", () => {
  it("blocks saving a blanked bio and explains why", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    render(<SettingsProfilePage />);

    const bio = await screen.findByLabelText("简介");
    await userEvent.clear(bio);

    const blocked = await screen.findByTestId("clear-blocked");
    expect(blocked).toHaveTextContent("简介");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mocked.updateMyProfile).not.toHaveBeenCalled();
  });

  it("names every field the backend cannot clear", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    render(<SettingsProfilePage />);

    await userEvent.clear(await screen.findByLabelText("简介"));
    await userEvent.clear(screen.getByLabelText("个人网站"));

    const blocked = await screen.findByTestId("clear-blocked");
    expect(blocked).toHaveTextContent("简介");
    expect(blocked).toHaveTextContent("个人网站");
  });

  it("does not block clearing a field that was already empty", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ bio: null }));
    render(<SettingsProfilePage />);

    const bio = await screen.findByLabelText("简介");
    expect(bio).toHaveValue("");
    await userEvent.type(bio, "先写点东西");
    await userEvent.clear(bio);

    // empty -> empty is not a change at all, so there is nothing to guard.
    expect(screen.queryByTestId("clear-blocked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("does not block filling in a previously empty field", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ bio: null }));
    mocked.updateMyProfile.mockResolvedValue(profile({ bio: "新写的简介", lockVersion: 4 }));

    render(<SettingsProfilePage />);

    const bio = await screen.findByLabelText("简介");
    await userEvent.type(bio, "新写的简介");

    expect(screen.queryByTestId("clear-blocked")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mocked.updateMyProfile).toHaveBeenCalledWith({
        lockVersion: 3,
        bio: "新写的简介",
      });
    });
  });

  it("rejects a non-http website before it ever reaches the backend", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    render(<SettingsProfilePage />);

    const website = await screen.findByLabelText("个人网站");
    await userEvent.clear(website);
    await userEvent.type(website, "ftp://example.com");

    expect(await screen.findByTestId("website-error")).toHaveTextContent("仅支持 http/https 链接");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(mocked.updateMyProfile).not.toHaveBeenCalled();
  });
});

/*
 * The guard must be an invariant, not just a disabled button. These cases submit
 * the form directly, the way implicit submission (Enter) or any future second
 * submit path would, and prove nothing reaches the backend.
 */
describe("SettingsProfilePage — the guard survives a bypassed submit", () => {
  it("refuses a cleared field even when the form is submitted directly", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    const { container } = render(<SettingsProfilePage />);

    await userEvent.clear(await screen.findByLabelText("简介"));

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(screen.getByTestId("clear-blocked")).toBeInTheDocument());
    expect(mocked.updateMyProfile).not.toHaveBeenCalled();
  });

  it("refuses an invalid website even when the form is submitted directly", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    const { container } = render(<SettingsProfilePage />);

    const website = await screen.findByLabelText("个人网站");
    await userEvent.clear(website);
    await userEvent.type(website, "ftp://example.com");

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getByTestId("website-error")).toBeInTheDocument());
    expect(mocked.updateMyProfile).not.toHaveBeenCalled();
  });

  it("refuses a no-op submit", async () => {
    mocked.getMyProfile.mockResolvedValue(profile());
    const { container } = render(<SettingsProfilePage />);

    await screen.findByLabelText("昵称");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.queryByTestId("profile-dirty")).toBeNull());
    expect(mocked.updateMyProfile).not.toHaveBeenCalled();
  });
});

/*
 * Visibility must stay honest.
 *
 * Live-verified 2026-09-22: the backend's `getPublicProfile` guards with
 * `if (visibility != Visibility.PRIVATE)`, skipping the AccessPolicy deny
 * branch for PRIVATE. A PRIVATE profile is therefore still served to a
 * stranger, and PRIVATE vs UNLISTED responses are byte-identical once the
 * echoed `visibility` string is scrubbed. PRIVATE is also the registration
 * default — so it must NOT appear as a third option promising "仅自己".
 */
describe("SettingsProfilePage — visibility is described truthfully", () => {
  it("renders the stored PRIVATE default as 不列出, with no third option", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ visibility: "PRIVATE" }));

    render(<SettingsProfilePage />);

    expect(await screen.findByLabelText("不列出")).toBeChecked();
    expect(screen.getByLabelText("公开")).not.toBeChecked();
    expect(screen.queryByLabelText("仅自己")).toBeNull();
    expect(screen.queryByLabelText("资料可见性")).toBeNull(); // the old <select> is gone
  });

  it("never shows a privacy promise the backend does not keep", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ visibility: "PRIVATE" }));

    const { container } = render(<SettingsProfilePage />);

    await screen.findByLabelText("不列出");
    expect(container.textContent ?? "").not.toContain("仅自己");
    expect(container.textContent ?? "").not.toContain("仅我");
  });

  it("does NOT silently rewrite a stored PRIVATE when only text changed", async () => {
    mocked.getMyProfile.mockResolvedValue(profile({ visibility: "PRIVATE" }));
    mocked.updateMyProfile.mockResolvedValue(
      profile({ visibility: "PRIVATE", displayName: "改过的昵称", lockVersion: 4 }),
    );

    render(<SettingsProfilePage />);

    const displayName = await screen.findByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "改过的昵称");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mocked.updateMyProfile).toHaveBeenCalledWith({
        lockVersion: 3,
        displayName: "改过的昵称",
      });
    });
    const payload = mocked.updateMyProfile.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect("visibility" in payload).toBe(false);
  });
});
