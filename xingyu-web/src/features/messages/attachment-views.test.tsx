import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ChatMessage } from "@/api/messages/messages.types";
import { senderLabel } from "./MessageBubble";
import { AttachmentFileList } from "./AttachmentFileList";
import { AttachmentMediaGrid } from "./AttachmentMediaGrid";

/*
 * The two shared-attachment views (Phase 2I-3b).
 *
 * Both render rows the backend already filtered (/media -> IMAGE only, /files
 * -> FILE only), so these tests pin the rendering contract: the link target, the
 * name fallback, and the "no attachment URL" case that the caller is supposed to
 * have filtered out.
 */

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "user-them",
    sequenceNumber: 1,
    body: "",
    messageType: "FILE",
    attachmentUrl: "https://cdn.example/a.pdf",
    attachmentName: "报告.pdf",
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

describe("AttachmentMediaGrid", () => {
  it("links each tile to the full image in a new tab", () => {
    render(
      <AttachmentMediaGrid
        items={[
          message({
            messageType: "IMAGE",
            attachmentUrl: "/files/x.png",
            attachmentName: "照片.png",
          }),
        ]}
      />,
    );

    const list = screen.getByLabelText("图片列表");
    const link = within(list).getByRole("link");
    expect(link).toHaveAttribute("href", "/files/x.png");
    expect(link).toHaveAttribute("target", "_blank");
    // rel=noreferrer, not just a bare target: an attachment URL is user-supplied
    // and must not be able to reach back through window.opener.
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(within(list).getByRole("img", { name: "照片.png" })).toHaveAttribute(
      "src",
      "/files/x.png",
    );
  });

  it("lazy-loads tiles so a long media list does not fetch everything at once", () => {
    render(
      <AttachmentMediaGrid items={[message({ messageType: "IMAGE", attachmentName: "a.png" })]} />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });

  it("falls back to a generic alt/name rather than rendering an empty label", () => {
    render(
      <AttachmentMediaGrid
        items={[
          message({ messageType: "IMAGE", attachmentUrl: "/files/x.png", attachmentName: null }),
        ]}
      />,
    );
    // The img gets the generic alt.
    const img = screen.getByRole("img", { name: "图片" });
    expect(img).toBeInTheDocument();

    // The caption is a separate element, so query it through its container
    // rather than by text: getAllByText collapses identical strings that nest.
    const caption = img.closest("a")?.parentElement?.querySelector("span");
    expect(caption).toHaveTextContent("图片");
  });

  it("renders one tile per row, keyed separately", () => {
    render(
      <AttachmentMediaGrid
        items={[
          message({
            id: "a",
            messageType: "IMAGE",
            attachmentUrl: "/a.png",
            attachmentName: "a.png",
          }),
          message({
            id: "b",
            messageType: "IMAGE",
            attachmentUrl: "/b.png",
            attachmentName: "b.png",
          }),
        ]}
      />,
    );
    expect(within(screen.getByLabelText("图片列表")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders no timestamp when createdAt is missing instead of a bogus one", () => {
    const { container } = render(
      <AttachmentMediaGrid
        items={[message({ messageType: "IMAGE", attachmentUrl: "/a.png", createdAt: null })]}
      />,
    );
    expect(container.querySelector("time")).toBeNull();
  });
});

describe("AttachmentFileList", () => {
  it("links the file name to the stored file", () => {
    render(<AttachmentFileList items={[message()]} />);

    const link = within(screen.getByLabelText("文件列表")).getByRole("link", { name: "报告.pdf" });
    expect(link).toHaveAttribute("href", "https://cdn.example/a.pdf");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("falls back to 附件 when the payload carries no name", () => {
    render(<AttachmentFileList items={[message({ attachmentName: null })]} />);
    expect(screen.getByRole("link", { name: "附件" })).toBeInTheDocument();
  });

  it("does NOT invent a filename from the storage path", () => {
    // The URL ends in a uuid; cutting the last segment would look like a real
    // filename and is not one. The honest fallback is the generic label.
    render(
      <AttachmentFileList
        items={[message({ attachmentName: null, attachmentUrl: "/files/9f2a-4b1c.pdf" })]}
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("附件");
    expect(link).not.toHaveTextContent("9f2a");
  });

  it("labels the sender from the id, since no profile data is available", () => {
    render(<AttachmentFileList items={[message({ senderId: "user-them" })]} />);
    expect(screen.getByText(senderLabel("user-them"))).toBeInTheDocument();
  });

  it("renders a time for each row and none when unknown", () => {
    const { container, unmount } = render(
      <AttachmentFileList items={[message({ createdAt: "2026-09-27T02:00:00Z" })]} />,
    );
    // 02:00 UTC == 10:00 in Shanghai.
    expect(within(container).getByText("09/27 10:00")).toBeInTheDocument();
    unmount();

    const second = render(<AttachmentFileList items={[message({ createdAt: null })]} />);
    expect(second.container.querySelector("time")).toBeNull();
  });

  it("renders one row per item", () => {
    render(
      <AttachmentFileList
        items={[
          message({ id: "a", attachmentName: "a.pdf", attachmentUrl: "/a.pdf" }),
          message({ id: "b", attachmentName: "b.zip", attachmentUrl: "/b.zip" }),
        ]}
      />,
    );
    expect(within(screen.getByLabelText("文件列表")).getAllByRole("listitem")).toHaveLength(2);
  });
});
