import { describe, expect, it } from "vitest";
import type { MyGroupJoinRequest } from "@/api/messages/messages.types";
import {
  groupIsGone,
  isPending,
  joinModeNote,
  joinRequestStatusLabel,
  requestConversationHref,
  requestKey,
  requestMessage,
  requestTitle,
  splitByPending,
} from "./group-join-requests";

function request(overrides: Partial<MyGroupJoinRequest> = {}): MyGroupJoinRequest {
  return {
    id: "r1",
    conversationId: "g1",
    conversationTitle: "读书会",
    joinMode: "APPROVAL",
    message: "想加入",
    status: "PENDING",
    createdAt: "2026-09-01T10:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("joinRequestStatusLabel", () => {
  it("translates exactly the three states the backend can write", () => {
    // ConversationService:339 PENDING, :360 APPROVED, :382 REJECTED.
    expect(joinRequestStatusLabel("PENDING")).toBe("待处理");
    expect(joinRequestStatusLabel("APPROVED")).toBe("已通过");
    expect(joinRequestStatusLabel("REJECTED")).toBe("已拒绝");
  });

  it("is case-insensitive", () => {
    expect(joinRequestStatusLabel("pending")).toBe("待处理");
  });

  it("echoes an unknown state verbatim instead of blanking it", () => {
    // Containment rule: a new backend state must stay visible.
    expect(joinRequestStatusLabel("WITHDRAWN")).toBe("WITHDRAWN");
  });

  it("falls back only when there is nothing at all", () => {
    expect(joinRequestStatusLabel(null)).toBe("状态未知");
    expect(joinRequestStatusLabel("")).toBe("状态未知");
    expect(joinRequestStatusLabel(undefined)).toBe("状态未知");
  });

  it("does NOT reuse Legacy's report-status vocabulary", () => {
    // Legacy's report page used PENDING/UNDER_REVIEW/RESOLVED/CLOSED, of which
    // three never occur (§三·补4). Those labels must not leak in here.
    expect(joinRequestStatusLabel("UNDER_REVIEW")).not.toBe("审核中");
    expect(joinRequestStatusLabel("RESOLVED")).not.toBe("已解决");
  });
});

describe("isPending", () => {
  it("counts only PENDING as awaiting the owner", () => {
    expect(isPending(request({ status: "PENDING" }))).toBe(true);
    expect(isPending(request({ status: "APPROVED" }))).toBe(false);
    expect(isPending(request({ status: "REJECTED" }))).toBe(false);
  });
});

describe("groupIsGone / requestTitle", () => {
  it("treats a null title as the group being gone", () => {
    // ConversationService:177 passes null when the conversation row is missing.
    expect(groupIsGone(request({ conversationTitle: null }))).toBe(true);
    expect(groupIsGone(request({ conversationTitle: "  " }))).toBe(true);
    expect(groupIsGone(request({ conversationTitle: "读书会" }))).toBe(false);
  });

  it("does not fabricate a title", () => {
    // Deliberately unlike conversationLabel()'s "未命名群聊": here the target is
    // gone, and inventing a name would hide that.
    expect(requestTitle(request({ conversationTitle: null }))).toBe("");
    expect(requestTitle(request({ conversationTitle: "读书会" }))).toBe("读书会");
  });
});

describe("splitByPending", () => {
  it("separates awaiting from decided, preserving order", () => {
    const input = [
      request({ id: "a", status: "PENDING" }),
      request({ id: "b", status: "APPROVED" }),
      request({ id: "c", status: "PENDING" }),
      request({ id: "d", status: "REJECTED" }),
    ];
    const { pending, resolved } = splitByPending(input);
    expect(pending.map((r) => r.id)).toEqual(["a", "c"]);
    expect(resolved.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("handles an empty list", () => {
    expect(splitByPending([])).toEqual({ pending: [], resolved: [] });
  });
});

describe("joinModeNote", () => {
  it("explains an approval-gated group", () => {
    expect(joinModeNote("APPROVAL")).toContain("群主审批");
  });

  it("flags an OPEN group as anomalous for a request row", () => {
    // An OPEN group admits anyone (ConversationService:312), so a request for one
    // is surprising and worth stating rather than smoothing over.
    expect(joinModeNote("OPEN")).toContain("无需申请");
  });

  it("says nothing for an unknown mode", () => {
    expect(joinModeNote("SOMETHING_ELSE")).toBe("");
    expect(joinModeNote(null)).toBe("");
  });
});

describe("requestMessage", () => {
  it("returns the applicant's note", () => {
    expect(requestMessage(request({ message: "想加入" }))).toBe("想加入");
  });

  it("treats null and blank-string alike", () => {
    // The column is nullable AND the wire can carry "".
    expect(requestMessage(request({ message: null }))).toBe("");
    expect(requestMessage(request({ message: "   " }))).toBe("");
  });
});

describe("requestConversationHref", () => {
  it("links to V2's real /messages/:conversationId route", () => {
    // The thread page tries DIRECT then falls back to GROUP, so this route does
    // serve groups — unlike Legacy's unrouted /messages/group/{id}.
    expect(requestConversationHref(request())).toBe("/messages/g1");
  });

  it("does NOT produce Legacy's /messages/group/{id} shape", () => {
    expect(requestConversationHref(request())).not.toContain("/messages/group/");
  });

  it("returns null when the group is gone — there is nothing to open", () => {
    expect(requestConversationHref(request({ conversationTitle: null }))).toBeNull();
  });

  it("returns null for a blank conversationId", () => {
    expect(requestConversationHref(request({ conversationId: "  " }))).toBeNull();
  });

  it("encodes a reserved character in the id", () => {
    expect(requestConversationHref(request({ conversationId: "a/b" }))).toBe("/messages/a%2Fb");
  });
});

describe("requestKey", () => {
  it("uses the id, which DOES exist on this DTO", () => {
    // Contrast with PendingAction, which has no id at all.
    expect(requestKey(request({ id: "r9" }))).toBe("r9");
  });
});
