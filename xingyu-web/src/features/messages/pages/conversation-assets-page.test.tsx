import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { ConversationAssetsPage } from "./ConversationAssetsPage";

/*
 * The shared-media / shared-files page (Phase 2I-3b).
 *
 * One component, two modes — the mode decides which endpoint is called, and a
 * recalled row must not be rendered (the backend nulls its attachment, so it
 * would be a broken tile or a dead link).
 */

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listMedia: vi.fn(),
    listFiles: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

function image(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "u-2",
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

function file(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    ...image(),
    messageType: "FILE",
    attachmentUrl: "/files/a.pdf",
    attachmentName: "a.pdf",
    ...overrides,
  };
}

function authRequired(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "请先登录",
    status: 401,
    detail: "请先登录",
    code: "AUTH_REQUIRED",
  });
}

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderAssets(kind: "media" | "files", conversationId = "c1") {
  return render(
    <MemoryRouter initialEntries={[`/messages/${conversationId}/${kind}`]}>
      <Routes>
        <Route path="/messages/:conversationId" element={<div>会话详情</div>} />
        <Route path="/login" element={<div>登录页</div>} />
        <Route path="/messages/:conversationId/:kind" element={<ConversationAssetsPage kind={kind} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConversationAssetsPage — endpoint selection", () => {
  it("media mode calls listMedia, not listFiles", async () => {
    mocked.listMedia.mockResolvedValue([]);
    renderAssets("media");

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(mocked.listMedia).toHaveBeenCalledWith("c1", 100);
    expect(mocked.listFiles).not.toHaveBeenCalled();
  });

  it("files mode calls listFiles, not listMedia", async () => {
    mocked.listFiles.mockResolvedValue([]);
    renderAssets("files");

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(mocked.listFiles).toHaveBeenCalledWith("c1", 100);
    expect(mocked.listMedia).not.toHaveBeenCalled();
  });
});

describe("ConversationAssetsPage — rendering", () => {
  it("renders the media grid for images", async () => {
    mocked.listMedia.mockResolvedValue([image({ attachmentName: "照片.png" })]);
    renderAssets("media");

    expect(await screen.findByLabelText("图片列表")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "照片.png" })).toBeInTheDocument();
  });

  it("renders the file list for files", async () => {
    mocked.listFiles.mockResolvedValue([file({ attachmentName: "报告.pdf" })]);
    renderAssets("files");

    expect(await screen.findByLabelText("文件列表")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "报告.pdf" })).toBeInTheDocument();
  });

  it("filters out a recalled row instead of rendering a broken tile", async () => {
    // The backend keeps the row but nulls its attachments, so rendering it in
    // the grid would draw a broken image and in the list a dead link.
    mocked.listMedia.mockResolvedValue([
      image({ id: "ok", attachmentName: "ok.png" }),
      image({
        id: "gone",
        attachmentUrl: null,
        attachmentName: null,
        recalledAt: "2026-09-27T04:00:00Z",
        body: "[消息已撤回]",
      }),
    ]);
    renderAssets("media");

    const list = await screen.findByLabelText("图片列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("img", { name: "ok.png" })).toBeInTheDocument();
  });

  it("shows the empty state once every row is recalled", async () => {
    mocked.listFiles.mockResolvedValue([
      file({ attachmentUrl: null, recalledAt: "2026-09-27T04:00:00Z" }),
    ]);
    renderAssets("files");

    // The count line reads 0 and the empty state is shown, so a fully-recalled
    // conversation does not render an empty list shell.
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("0 条")).toBeInTheDocument();
  });

  it("counts only the rows it actually renders", async () => {
    mocked.listFiles.mockResolvedValue([
      file({ id: "a" }),
      file({ id: "b" }),
      file({ id: "gone", attachmentUrl: null, recalledAt: "2026-09-27T04:00:00Z" }),
    ]);
    renderAssets("files");

    expect(await screen.findByLabelText("文件列表")).toBeInTheDocument();
    expect(screen.getByText("2 条")).toBeInTheDocument();
  });
});

describe("ConversationAssetsPage — navigation", () => {
  it("links back to the conversation and across to the other view", async () => {
    mocked.listMedia.mockResolvedValue([image()]);
    renderAssets("media");
    await screen.findByLabelText("图片列表");

    expect(screen.getByRole("link", { name: "返回会话" })).toHaveAttribute("href", "/messages/c1");
    expect(screen.getByRole("link", { name: "看文件" })).toHaveAttribute("href", "/messages/c1/files");
  });

  it("offers 看图片 from the files view", async () => {
    mocked.listFiles.mockResolvedValue([file()]);
    renderAssets("files");
    await screen.findByLabelText("文件列表");

    expect(screen.getByRole("link", { name: "看图片" })).toHaveAttribute("href", "/messages/c1/media");
  });

  it("escapes the conversation id in every link", () => {
    // Rendered directly rather than through the router: a literal "/" in the
    // initial path would split into two real segments and the route would never
    // match, which is a harness artefact and not what is under test. What IS
    // under test is that the id is percent-encoded into the href.
    mocked.listFiles.mockResolvedValue([file({ conversationId: "a/b" })]);
    render(
      <MemoryRouter initialEntries={["/messages/a%2Fb/files"]}>
        <Routes>
          <Route path="/messages/:conversationId/:kind" element={<ConversationAssetsPage kind="files" />} />
        </Routes>
      </MemoryRouter>,
    );

    // The `:conversationId` param arrives decoded ("a/b"), so every href must
    // re-encode it — otherwise a single-segment link would 404.
    return screen.findByLabelText("文件列表").then(() => {
      expect(screen.getByRole("link", { name: "返回会话" })).toHaveAttribute("href", "/messages/a%2Fb");
      expect(screen.getByRole("link", { name: "看图片" })).toHaveAttribute("href", "/messages/a%2Fb/media");
    });
  });

  it("refetches when 刷新 is pressed", async () => {
    mocked.listMedia.mockResolvedValue([image()]);
    renderAssets("media");
    await screen.findByLabelText("图片列表");
    expect(mocked.listMedia).toHaveBeenCalledTimes(1);

    // fireEvent, not a bare .click(): the handler triggers a state update, and
    // calling it outside act() makes React warn and the assertion race.
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(mocked.listMedia).toHaveBeenCalledTimes(2));
  });
});

describe("ConversationAssetsPage — errors", () => {
  it("tells an expired session to log in", async () => {
    mocked.listMedia.mockRejectedValue(authRequired());
    renderAssets("media");

    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("says the conversation is missing on a 404, without a login link", async () => {
    mocked.listMedia.mockRejectedValue(notFound());
    renderAssets("media");

    expect(await screen.findByText("这个会话不存在，或者你不在其中。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });

  it("does not blame the session on an unrelated failure", async () => {
    mocked.listMedia.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "服务异常",
        code: "INTERNAL_ERROR",
      }),
    );
    renderAssets("media");

    expect(await screen.findByText("无法读取这个会话的内容，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });
});

