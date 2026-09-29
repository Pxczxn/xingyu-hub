import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { filesApi } from "@/api/files/files.api";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { AttachmentPicker } from "./AttachmentPicker";

/*
 * The attachment send control (Phase 2I-3b).
 *
 * What matters here is the SEQUENCING, because it is the one place two endpoints
 * are stitched together:
 *   - a bad file must never reach the network (the backend would answer 500 and
 *     the user would see「系统繁忙」),
 *   - a good file uploads first and only then sends, and
 *   - a failure names the step that actually broke.
 */

vi.mock("@/api/files/files.api", () => ({
  filesApi: { uploadFile: vi.fn() },
}));

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    sendAttachment: vi.fn(),
  },
}));

const mockedFiles = vi.mocked(filesApi);
const mockedMessages = vi.mocked(messagesApi);

function fakeFile(name: string, size = 1024): File {
  // A File whose `size` is a getter — constructing a real 100 MB Blob would be
  // slow and pointless, and `name`/`size` are all the contract reads.
  const file = new File(["x"], name, { type: "" });
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

function created(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "u-me",
    sequenceNumber: 1,
    body: "",
    messageType: "IMAGE",
    attachmentUrl: "/files/a.png",
    attachmentName: "a.png",
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

function renderPicker(props: Partial<Parameters<typeof AttachmentPicker>[0]> = {}) {
  const onSent = vi.fn();
  const onError = vi.fn();
  render(
    <AttachmentPicker
      conversationId="c1"
      conversationType="DIRECT"
      disabled={false}
      onSent={onSent}
      onError={onError}
      {...props}
    />,
  );
  return { onSent, onError };
}

/** Picks a file through the hidden input, the way the browser would. */
function pick(file: File) {
  fireEvent.change(screen.getByTestId("attachment-input"), { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AttachmentPicker — validation before the network", () => {
  it("rejects a disallowed extension locally and never calls the upload", async () => {
    const { onError } = renderPicker();
    pick(fakeFile("script.svg"));

    expect(await screen.findByRole("alert")).toHaveTextContent("仅支持图片");
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("仅支持图片"));
    // The point of pre-validating: the backend answers a bad extension with a
    // 500, so nothing may be sent at all.
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
    expect(mockedMessages.sendAttachment).not.toHaveBeenCalled();
  });

  it("rejects an oversized file locally too", async () => {
    renderPicker();
    pick(fakeFile("big.zip", 101 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent("100 MB");
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
  });

  it("accepts the whole whitelist, not just images", () => {
    // The `accept` attribute must not be narrowed to images: PDFs and Office
    // files are supported and only images become IMAGE messages.
    renderPicker();
    const accept = screen.getByTestId("attachment-input").getAttribute("accept") ?? "";
    for (const ext of [".jpg", ".png", ".pdf", ".docx", ".xlsx", ".txt", ".md", ".csv", ".zip"]) {
      expect(accept).toContain(ext);
    }
  });
});

describe("AttachmentPicker — the two-step send", () => {
  it("uploads first, then sends a message referencing the returned url", async () => {
    mockedFiles.uploadFile.mockResolvedValue({
      url: "/api/v1/admin/files/community/messages/a.png",
      name: "照片.png",
      mimeType: "image/png",
    });
    const message = created({ attachmentUrl: "/api/v1/admin/files/community/messages/a.png" });
    mockedMessages.sendAttachment.mockResolvedValue(message);

    const calls: string[] = [];
    mockedFiles.uploadFile.mockImplementation(async () => {
      calls.push("upload");
      return { url: "/api/v1/admin/files/community/messages/a.png", name: "照片.png", mimeType: "image/png" };
    });
    mockedMessages.sendAttachment.mockImplementation(async () => {
      calls.push("send");
      return message;
    });

    const { onSent } = renderPicker();
    pick(fakeFile("照片.png"));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(message));
    expect(calls).toEqual(["upload", "send"]);

    // The type is derived from the extension — the backend stores what it is
    // given and never re-derives it, so this is the only place it is decided.
    expect(mockedMessages.sendAttachment).toHaveBeenCalledWith("c1", "DIRECT", {
      url: "/api/v1/admin/files/community/messages/a.png",
      name: "照片.png",
      messageType: "IMAGE",
    });
  });

  it("derives FILE for a non-image in the whitelist", async () => {
    mockedFiles.uploadFile.mockResolvedValue({ url: "/files/a.pdf", name: "报告.pdf", mimeType: "application/pdf" });
    mockedMessages.sendAttachment.mockResolvedValue(created({ messageType: "FILE" }));

    renderPicker();
    pick(fakeFile("报告.pdf"));

    await waitFor(() => expect(mockedMessages.sendAttachment).toHaveBeenCalled());
    expect(mockedMessages.sendAttachment).toHaveBeenCalledWith(
      "c1",
      "DIRECT",
      expect.objectContaining({ messageType: "FILE" }),
    );
  });

  it("sends into a group through the group path", async () => {
    mockedFiles.uploadFile.mockResolvedValue({ url: "/files/a.png", name: "a.png", mimeType: "image/png" });
    mockedMessages.sendAttachment.mockResolvedValue(created({ conversationType: "GROUP" }));

    renderPicker({ conversationType: "GROUP" });
    pick(fakeFile("a.png"));

    await waitFor(() => expect(mockedMessages.sendAttachment).toHaveBeenCalled());
    expect(mockedMessages.sendAttachment).toHaveBeenCalledWith("c1", "GROUP", expect.anything());
  });
});

describe("AttachmentPicker — failures name the step", () => {
  it("reports an upload failure as an upload failure", async () => {
    mockedFiles.uploadFile.mockRejectedValue(new Error("network"));

    const { onError, onSent } = renderPicker();
    pick(fakeFile("a.png"));

    expect(await screen.findByRole("alert")).toHaveTextContent("附件上传失败");
    expect(onError).toHaveBeenCalledWith("附件上传失败，请重试。");
    expect(onSent).not.toHaveBeenCalled();
    // The send must not be attempted when the upload never produced a URL.
    expect(mockedMessages.sendAttachment).not.toHaveBeenCalled();
  });

  it("reports a send failure as a send failure, not an upload failure", async () => {
    // Both calls run while the control is busy, so a phase flag is the only way
    // to tell them apart — this pins that the flag is set at the right moment.
    mockedFiles.uploadFile.mockResolvedValue({ url: "/files/a.png", name: "a.png", mimeType: "image/png" });
    mockedMessages.sendAttachment.mockRejectedValue(new Error("boom"));

    const { onError } = renderPicker();
    pick(fakeFile("a.png"));

    expect(await screen.findByRole("alert")).toHaveTextContent("附件发送失败");
    expect(onError).toHaveBeenCalledWith("附件发送失败，请重试。");
    expect(mockedFiles.uploadFile).toHaveBeenCalledTimes(1);
  });

  it("prefers the backend's own reason over the generic copy", async () => {
    mockedFiles.uploadFile.mockResolvedValue({ url: "/files/a.png", name: "a.png", mimeType: "image/png" });
    mockedMessages.sendAttachment.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "无法发送",
        status: 409,
        detail: "无法向该用户发送私信",
        code: "CONFLICT",
      }),
    );

    renderPicker();
    pick(fakeFile("a.png"));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法向该用户发送私信");
  });
});

describe("AttachmentPicker — repeat attempts", () => {
  it("can retry with the SAME file after a failure", async () => {
    // The input value is reset after every attempt, so re-picking the same file
    // still fires `change`. Without that reset a failed upload could never be
    // retried with the same file — the change event simply would not fire.
    mockedFiles.uploadFile.mockRejectedValueOnce(new Error("network"));
    const { onSent } = renderPicker();

    const file = fakeFile("a.png");
    pick(file);
    expect(await screen.findByRole("alert")).toHaveTextContent("附件上传失败");

    mockedFiles.uploadFile.mockResolvedValue({ url: "/files/a.png", name: "a.png", mimeType: "image/png" });
    mockedMessages.sendAttachment.mockResolvedValue(created());
    pick(file);

    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(mockedFiles.uploadFile).toHaveBeenCalledTimes(2);
  });

  it("ignores a pick that carries no file", () => {
    renderPicker();
    fireEvent.change(screen.getByTestId("attachment-input"), { target: { files: [] } });
    expect(mockedFiles.uploadFile).not.toHaveBeenCalled();
  });
});

describe("AttachmentPicker — busy state", () => {
  it("disables the control while a text send is in flight", () => {
    renderPicker({ disabled: true });
    expect(screen.getByRole("button", { name: "添加附件" })).toBeDisabled();
  });

  it("shows 上传中… and blocks a second pick while working", async () => {
    let release: (value: { url: string; name: string; mimeType: string }) => void = () => {};
    mockedFiles.uploadFile.mockReturnValue(new Promise((resolve) => {
      release = resolve;
    }));
    mockedMessages.sendAttachment.mockResolvedValue(created());

    renderPicker();
    pick(fakeFile("a.png"));

    expect(await screen.findByRole("button", { name: "添加附件" })).toBeDisabled();
    expect(screen.getByText("上传中…")).toBeInTheDocument();

    release({ url: "/files/a.png", name: "a.png", mimeType: "image/png" });
    await waitFor(() => expect(screen.getByText("附件")).toBeInTheDocument());
  });
});

