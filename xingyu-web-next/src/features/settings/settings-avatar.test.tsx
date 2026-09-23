import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/client";
import { filesApi } from "@/api/files/files.api";
import { clientSettingsApi } from "@/api/settings/client-settings.api";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { AVATAR_ACCEPT_ATTR, AVATAR_MAX_BYTES } from "./avatar-file";
import { SettingsProfilePage } from "./pages/SettingsProfilePage";

/*
 * Avatar loop on /settings/profile (Phase 2A-2c).
 *
 * The real chain is TWO requests (verified live 2026-09-23):
 *   1. POST /api/v1/messages/upload    -> { url }
 *   2. PUT  /api/v1/me/client-settings -> { avatar: url }
 *
 * Everything here is about the parts jsdom CAN prove: validation, the object
 * URL lifecycle, the handler-level duplicate-click guard, and — most
 * importantly — that a failure never produces a fake success.
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

vi.mock("@/api/files/files.api", () => ({
  filesApi: { uploadFile: vi.fn() },
}));

vi.mock("@/api/settings/client-settings.api", () => ({
  clientSettingsApi: { updateAvatar: vi.fn() },
}));

const mockedUsers = vi.mocked(usersApi);
const mockedFiles = vi.mocked(filesApi);
const mockedSettings = vi.mocked(clientSettingsApi);

const SAVED_AVATAR = "/api/v1/admin/files/community/messages/saved.png";

function profile(overrides: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    username: "tester",
    displayName: "测试昵称",
    bio: "一段简介",
    websiteUrl: "https://example.com",
    visibility: "PUBLIC",
    lockVersion: 3,
    ...overrides,
  };
}

function pngFile(name = "avatar.png", size = 2048, type = "image/png"): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function apiError(status: number, detail: string, code = "INTERNAL_ERROR"): ApiError {
  return new ApiError({ type: "about:blank", title: "请求失败", status, detail, code });
}

let createdUrls: string[] = [];
let revokedUrls: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  createdUrls = [];
  revokedUrls = [];

  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => {
      const url = `blob:mock/${++counter}`;
      createdUrls.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn((url: string) => {
      revokedUrls.push(url);
    }),
  });

  mockedUsers.getMyProfile.mockResolvedValue(profile());
  mockedSettings.updateAvatar.mockResolvedValue({});
});

/** Select a file the way the browser does (change event carrying `files`). */
function selectFile(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText("选择头像图片") as HTMLInputElement;
}

async function renderPage() {
  const view = render(<SettingsProfilePage />);
  await screen.findByLabelText("昵称");
  return view;
}

describe("avatar — picker and preview", () => {
  it("only offers the formats the backend really accepts", async () => {
    await renderPage();

    expect(fileInput()).toHaveAttribute("accept", AVATAR_ACCEPT_ATTR);
    // svg / bmp / ico all 500 on the backend, so they must not be advertised.
    expect(fileInput().getAttribute("accept")).not.toContain("svg");
  });

  it("shows a local preview for a valid file, labelled as not-yet-saved", async () => {
    await renderPage();

    selectFile(fileInput(), pngFile());

    const preview = await screen.findByTestId("avatar-image");
    expect(preview).toHaveAttribute("src", "blob:mock/1");
    expect(screen.getByTestId("avatar-preview-hint")).toHaveTextContent("预览（尚未保存）");
    // Nothing has been sent anywhere yet.
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
    expect(mockedSettings.updateAvatar).not.toHaveBeenCalled();
  });

  it("rejects an unsupported format before any request, keeping the saved avatar", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    await renderPage();

    selectFile(fileInput(), pngFile("avatar.svg", 1024, "image/svg+xml"));

    expect(await screen.findByTestId("avatar-error")).toHaveTextContent(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", SAVED_AVATAR);
  });

  it("rejects an oversized file before any request", async () => {
    await renderPage();

    selectFile(fileInput(), pngFile("huge.png", AVATAR_MAX_BYTES + 1));

    expect(await screen.findByTestId("avatar-error")).toHaveTextContent("图片不能超过 100 MB");
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
  });

  it("revokes the previous object URL when another file is picked", async () => {
    await renderPage();

    selectFile(fileInput(), pngFile("first.png"));
    await screen.findByTestId("avatar-image");
    selectFile(fileInput(), pngFile("second.png"));

    await waitFor(() => expect(revokedUrls).toContain("blob:mock/1"));
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "blob:mock/2");
  });

  it("revokes the object URL on unmount", async () => {
    const view = await renderPage();

    selectFile(fileInput(), pngFile());
    await screen.findByTestId("avatar-image");
    expect(createdUrls).toEqual(["blob:mock/1"]);

    view.unmount();

    expect(revokedUrls).toContain("blob:mock/1");
  });

  it("revokes the object URL once the upload succeeds", async () => {
    mockedFiles.uploadFile.mockResolvedValue({
      url: SAVED_AVATAR,
      name: "avatar.png",
      mimeType: "image/png",
    });
    mockedSettings.updateAvatar.mockResolvedValue({ avatar: SAVED_AVATAR });
    await renderPage();

    selectFile(fileInput(), pngFile());
    await screen.findByTestId("avatar-image");
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));

    await screen.findByTestId("avatar-saved");
    await waitFor(() => expect(revokedUrls).toContain("blob:mock/1"));
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", SAVED_AVATAR);
  });
});

describe("avatar — the two-phase upload", () => {
  it("uploads first, then writes the avatar, and adopts the server value", async () => {
    mockedFiles.uploadFile.mockResolvedValue({
      url: "/api/v1/admin/files/community/messages/new.png",
      name: "avatar.png",
      mimeType: "image/png",
    });
    mockedSettings.updateAvatar.mockResolvedValue({
      avatar: "/api/v1/admin/files/community/messages/new.png",
    });

    await renderPage();
    selectFile(fileInput(), pngFile());
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));

    await screen.findByTestId("avatar-saved");
    expect(mockedFiles.uploadFile).toHaveBeenCalledTimes(1);
    expect(mockedSettings.updateAvatar).toHaveBeenCalledTimes(1);
    expect(mockedSettings.updateAvatar).toHaveBeenCalledWith(
      "/api/v1/admin/files/community/messages/new.png",
    );
    expect(screen.getByTestId("avatar-image")).toHaveAttribute(
      "src",
      "/api/v1/admin/files/community/messages/new.png",
    );
    // A successful save is no longer a preview.
    expect(screen.queryByTestId("avatar-preview-hint")).not.toBeInTheDocument();
  });

  it("never sends the same upload twice when the button is clicked twice", async () => {
    let resolveUpload: (value: { url: string; name: string; mimeType: string }) => void = () => {};
    mockedFiles.uploadFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    mockedSettings.updateAvatar.mockResolvedValue({ avatar: SAVED_AVATAR });

    await renderPage();
    selectFile(fileInput(), pngFile());

    const uploadButton = screen.getByRole("button", { name: "上传头像" });
    /*
     * Both clicks land inside one `act`, so React has not re-rendered (and the
     * button is not yet disabled) when the second one arrives. That is the only
     * way this proves the handler-level guard rather than the `disabled` prop —
     * see the reverse-verification note in the phase report.
     */
    await act(async () => {
      uploadButton.click();
      uploadButton.click();
    });

    resolveUpload({ url: SAVED_AVATAR, name: "avatar.png", mimeType: "image/png" });

    await screen.findByTestId("avatar-saved");
    expect(mockedFiles.uploadFile).toHaveBeenCalledTimes(1);
    expect(mockedSettings.updateAvatar).toHaveBeenCalledTimes(1);
  });

  it("does not touch the profile when the upload fails", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    mockedFiles.uploadFile.mockRejectedValue(apiError(500, "系统繁忙，请稍后再试"));

    await renderPage();
    selectFile(fileInput(), pngFile());
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));

    const error = await screen.findByTestId("avatar-error");
    expect(error).toHaveTextContent("图片上传失败");
    // Step 2 must never run after a failed step 1.
    expect(mockedSettings.updateAvatar).not.toHaveBeenCalled();
    // The saved avatar is untouched, and the selection is kept so retry works.
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "blob:mock/1");
    expect(screen.queryByTestId("avatar-saved")).not.toBeInTheDocument();
  });

  it("reports a failure and keeps the OLD avatar when the settings write fails", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    mockedFiles.uploadFile.mockResolvedValue({
      url: "/api/v1/admin/files/community/messages/new.png",
      name: "avatar.png",
      mimeType: "image/png",
    });
    mockedSettings.updateAvatar.mockRejectedValue(apiError(500, "系统繁忙，请稍后再试"));

    await renderPage();
    selectFile(fileInput(), pngFile());
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));

    const error = await screen.findByTestId("avatar-error");
    expect(error).toHaveTextContent("头像保存失败");
    expect(error).toHaveTextContent("当前头像未变更");
    // No fake success: the preview stays and is still labelled as unsaved.
    expect(screen.queryByTestId("avatar-saved")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-preview-hint")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "blob:mock/1");
  });

  it("retries only the settings write, never re-uploading the file", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    mockedFiles.uploadFile.mockResolvedValue({
      url: "/api/v1/admin/files/community/messages/new.png",
      name: "avatar.png",
      mimeType: "image/png",
    });
    mockedSettings.updateAvatar.mockRejectedValueOnce(apiError(500, "系统繁忙，请稍后再试"));
    mockedSettings.updateAvatar.mockResolvedValueOnce({
      avatar: "/api/v1/admin/files/community/messages/new.png",
    });

    await renderPage();
    selectFile(fileInput(), pngFile());
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));
    await screen.findByTestId("avatar-error");

    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));

    await screen.findByTestId("avatar-saved");
    // The file is already stored; a second upload would only add an orphan.
    expect(mockedFiles.uploadFile).toHaveBeenCalledTimes(1);
    expect(mockedSettings.updateAvatar).toHaveBeenCalledTimes(2);
  });
});

describe("avatar — existing value, fallback and reset", () => {
  it("renders the avatar that came back from the profile", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));

    await renderPage();

    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", SAVED_AVATAR);
    expect(screen.queryByTestId("avatar-fallback")).not.toBeInTheDocument();
  });

  it("falls back to the display-name initial when there is no avatar", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: null }));

    await renderPage();

    expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("测");
    // Nothing to reset yet, so the control is absent rather than broken.
    expect(screen.queryByRole("button", { name: "恢复默认头像" })).not.toBeInTheDocument();
  });

  it("resets to the default avatar through the same settings endpoint", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    mockedSettings.updateAvatar.mockResolvedValue({});

    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "恢复默认头像" }));

    await screen.findByTestId("avatar-saved");
    expect(mockedSettings.updateAvatar).toHaveBeenCalledWith(null);
    expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
  });

  it("shows the saved avatar again after a remount (the reload path)", async () => {
    mockedFiles.uploadFile.mockResolvedValue({
      url: SAVED_AVATAR,
      name: "avatar.png",
      mimeType: "image/png",
    });
    mockedSettings.updateAvatar.mockResolvedValue({ avatar: SAVED_AVATAR });

    const view = await renderPage();
    selectFile(fileInput(), pngFile());
    await userEvent.click(screen.getByRole("button", { name: "上传头像" }));
    await screen.findByTestId("avatar-saved");

    view.unmount();
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    render(<SettingsProfilePage />);

    expect(await screen.findByTestId("avatar-image")).toHaveAttribute("src", SAVED_AVATAR);
  });
});

/*
 * The app really renders under <StrictMode> (src/main.tsx), and StrictMode
 * double-invokes state updaters and effects in development. Minting the preview
 * object URL inside a state updater therefore created TWO URLs per selection and
 * leaked one — completely invisible to the tests above, which render without
 * StrictMode. These two cases exist specifically to keep that from coming back.
 */
describe("avatar — preview survives StrictMode", () => {
  it("creates exactly one object URL per selection, releasing the replaced one", async () => {
    render(
      <StrictMode>
        <SettingsProfilePage />
      </StrictMode>,
    );
    await screen.findByLabelText("昵称");

    selectFile(fileInput(), pngFile("a.png"));
    await screen.findByTestId("avatar-image");
    expect(createdUrls).toEqual(["blob:mock/1"]);
    expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "blob:mock/1");

    selectFile(fileInput(), pngFile("b.png"));
    await waitFor(() =>
      expect(screen.getByTestId("avatar-image")).toHaveAttribute("src", "blob:mock/2"),
    );
    expect(createdUrls).toEqual(["blob:mock/1", "blob:mock/2"]);
    expect(revokedUrls).toEqual(["blob:mock/1"]);
  });

  it("releases the last object URL on unmount", async () => {
    const view = render(
      <StrictMode>
        <SettingsProfilePage />
      </StrictMode>,
    );
    await screen.findByLabelText("昵称");

    selectFile(fileInput(), pngFile("a.png"));
    await screen.findByTestId("avatar-image");

    view.unmount();

    expect(revokedUrls).toEqual(["blob:mock/1"]);
  });
});

describe("avatar — the text form stays independent", () => {
  it("does not include the avatar in the profile patch", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ avatar: SAVED_AVATAR }));
    mockedUsers.updateMyProfile.mockResolvedValue(profile({ displayName: "新昵称", lockVersion: 4 }));

    await renderPage();
    const displayName = screen.getByLabelText("昵称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "新昵称");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mockedUsers.updateMyProfile).toHaveBeenCalledTimes(1));
    const payload = mockedUsers.updateMyProfile.mock.calls[0][0] as Record<string, unknown>;
    expect("avatar" in payload).toBe(false);
    expect(payload).toEqual({ lockVersion: 3, displayName: "新昵称" });
    // Saving the text fields never touches the avatar endpoint.
    expect(mockedSettings.updateAvatar).not.toHaveBeenCalled();
  });
});
