import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { AttachmentFileList } from "./AttachmentFileList";
import { AttachmentMediaGrid } from "./AttachmentMediaGrid";

/*
 * The two shared-attachment views.
 *
 * Both render rows the backend already filtered (/media -> IMAGE only, /files
 * -> FILE only), so these tests pin the rendering contract.
 *
 * 2026-10-06: the link target is no longer the raw `attachmentUrl`. That address
 * (`/api/v1/admin/files/...`) performs NO session check — measured 200 with no token —
 * so it is display-only now. Each tile fetches the bytes through the member-checked
 * endpoint and gets an object URL. That is what these tests assert.
 */

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "user-them",
    sender: { userId: "user-them", username: "them", displayName: "小明", avatar: null },
    sequenceNumber: 1,
    body: "",
    messageType: "FILE",
    attachmentUrl: "/api/v1/admin/files/community/messages/a.pdf",
    attachmentName: "报告.pdf",
    attachmentFileId: 11,
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

let objectUrlCounter = 0;

beforeEach(() => {
  vi.restoreAllMocks();
  objectUrlCounter = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => `blob:att-${(objectUrlCounter += 1)}`),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(messagesApi, "downloadAttachment").mockResolvedValue(new Blob(["x"]) as never);
});

describe("AttachmentMediaGrid", () => {
  it("links each tile to the member-checked download, not the raw url", async () => {
    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[
          message({
            messageType: "IMAGE",
            attachmentUrl: "/api/v1/admin/files/community/messages/x.png",
            attachmentName: "照片.png",
            attachmentFileId: 3,
          }),
        ]}
      />,
    );

    const list = screen.getByLabelText("图片列表");
    const img = await within(list).findByRole("img", { name: "照片.png" });
    expect(messagesApi.downloadAttachment).toHaveBeenCalledWith("c1", "m1");
    expect(img).toHaveAttribute("src", "blob:att-1");

    const link = within(list).getByRole("link");
    expect(link).toHaveAttribute("href", "blob:att-1");
    expect(link).toHaveAttribute("target", "_blank");
    // rel=noreferrer, not just a bare target: an attachment URL is user-supplied
    // and must not be able to reach back through window.opener.
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("lazy-loads tiles so a long media list does not fetch everything at once", async () => {
    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[
          message({ id: "m1", messageType: "IMAGE", attachmentFileId: 1 }),
          message({ id: "m2", messageType: "IMAGE", attachmentFileId: 2 }),
        ]}
      />,
    );

    const images = await screen.findAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("loading", "lazy");
  });

  it("falls back to a generic alt/name rather than rendering an empty label", async () => {
    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[message({ id: "m1", messageType: "IMAGE", attachmentName: null, attachmentFileId: 1 })]}
      />,
    );

    expect(await screen.findByRole("img", { name: "图片" })).toBeInTheDocument();
    expect(screen.getByText("图片")).toBeInTheDocument();
  });

  it("does not render a broken tile when the bytes cannot be fetched", () => {
    vi.spyOn(messagesApi, "downloadAttachment").mockRejectedValue(new Error("403"));
    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[message({ id: "m1", messageType: "IMAGE", attachmentFileId: 1 })]}
      />,
    );

    // A recalled row (attachments nulled server-side) has no fileId at all; a
    // forbidden one fails. Neither may look like a broken image.
    expect(screen.getByText("加载中…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders one tile per row, keyed separately", async () => {
    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[
          message({ id: "m1", messageType: "IMAGE", attachmentFileId: 1 }),
          message({ id: "m2", messageType: "IMAGE", attachmentFileId: 2 }),
        ]}
      />,
    );

    await screen.findAllByRole("img");
    expect(within(screen.getByLabelText("图片列表")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders a time for each row and none when unknown", async () => {
    const { unmount } = render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[message({ id: "m1", messageType: "IMAGE", attachmentFileId: 1 })]}
      />,
    );
    await screen.findAllByRole("img");
    expect(screen.getByText("09/27 10:00")).toBeInTheDocument();
    unmount();

    render(
      <AttachmentMediaGrid
        conversationId="c1"
        items={[
          message({ id: "m2", messageType: "IMAGE", attachmentFileId: 2, createdAt: null }),
        ]}
      />,
    );
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
  });
});

describe("AttachmentFileList", () => {
  function renderList(items: ChatMessage[]) {
    return render(
      <MemoryRouter>
        <AttachmentFileList conversationId="c1" items={items} />
      </MemoryRouter>,
    );
  }

  it("links the file name to the member-checked download", async () => {
    renderList([message()]);
    const link = await screen.findByRole("link", { name: "报告.pdf" });
    expect(messagesApi.downloadAttachment).toHaveBeenCalledWith("c1", "m1");
    expect(link).toHaveAttribute("href", "blob:att-1");
    expect(link).toHaveAttribute("download", "报告.pdf");
  });

  it("falls back to 附件 when the payload carries no name", async () => {
    renderList([message({ attachmentName: null })]);
    expect(await screen.findByRole("link", { name: "附件" })).toBeInTheDocument();
  });

  it("does NOT invent a filename from the storage path", async () => {
    renderList([message({ attachmentName: null })]);
    await screen.findByRole("link", { name: "附件" });
    // The URL used to be shown as if it were a name; a storage path is not one.
    expect(screen.queryByText(/community\/messages/)).not.toBeInTheDocument();
  });

  it("labels the sender from the structured profile (2026-10-06)", async () => {
    renderList([message()]);
    await screen.findByRole("link", { name: "报告.pdf" });
    expect(screen.getByText("小明")).toBeInTheDocument();
    expect(screen.queryByText(/user-them/)).not.toBeInTheDocument();
  });

  it("renders a time for each row and none when unknown", async () => {
    const { unmount } = renderList([message()]);
    await screen.findByRole("link", { name: "报告.pdf" });
    expect(screen.getByText("09/27 10:00")).toBeInTheDocument();
    unmount();

    renderList([message({ id: "m2", createdAt: null })]);
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
  });

  it("renders one row per item", () => {
    renderList([message({ id: "m1" }), message({ id: "m2" })]);
    expect(within(screen.getByLabelText("文件列表")).getAllByRole("listitem")).toHaveLength(2);
  });
});
