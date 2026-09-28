import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type {
  CollaborationAcceptResult,
  CollaborationInviteResolve,
} from "@/api/collaboration/collaboration.types";
import { CollaborationAcceptPage } from "./CollaborationAcceptPage";

/*
 * /studio/collaboration/accept?token=... (Phase 2M).
 *
 * The two things that MUST hold:
 *   1. The success view discloses that no permission was granted — it says
 *      「已确认邀请」, never Legacy's 「已接受协作邀请」/「查看协作空间」.
 *   2. The follow-up link is `/u/:username`, NOT Legacy's `/u/:username/works`
 *      (which is not a V2 route and 404s).
 */

vi.mock("@/api/collaboration/collaboration.api", () => ({
  collaborationApi: {
    createInvite: vi.fn(),
    resolveInvite: vi.fn(),
    acceptInvite: vi.fn(),
  },
}));

const mockedApi = vi.mocked(collaborationApi);

function resolved(overrides: Partial<CollaborationInviteResolve> = {}): CollaborationInviteResolve {
  return {
    valid: true,
    inviterUsername: "alice",
    inviterDisplayName: "爱丽丝",
    note: "一起写吧",
    expiresAt: "2026-10-05T10:00:00Z",
    ...overrides,
  };
}

function accepted(overrides: Partial<CollaborationAcceptResult> = {}): CollaborationAcceptResult {
  return {
    accepted: true,
    inviterUsername: "alice",
    inviterDisplayName: "爱丽丝",
    note: "一起写吧",
    ...overrides,
  };
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/studio/collaboration/accept${search}`]}>
      <Routes>
        <Route path="/studio/collaboration/accept" element={<CollaborationAcceptPage />} />
        <Route path="/studio" element={<p>创作中心</p>} />
        <Route path="/u/:username" element={<p>用户主页</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("collaboration accept page", () => {
  it("asks for a link when no token is present", async () => {
    renderAt("");
    expect(await screen.findByTestId("page-state-empty")).toHaveTextContent("缺少邀请链接");
    expect(mockedApi.resolveInvite).not.toHaveBeenCalled();
  });

  it("resolves the token on mount and names the inviter", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    renderAt("?token=tok-abc");

    expect(await screen.findByTestId("accept-inviter")).toHaveTextContent("爱丽丝");
    expect(mockedApi.resolveInvite).toHaveBeenCalledWith("tok-abc");
  });

  it("shows the boundary note before the user confirms", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    renderAt("?token=tok-abc");

    expect(await screen.findByTestId("accept-boundary")).toHaveTextContent(
      "不会因此获得任何协作权限",
    );
  });

  it("treats valid:false (a 200) as an invalid invite, not a crash", async () => {
    // The backend returns HTTP 200 with {valid:false} for a bad token.
    mockedApi.resolveInvite.mockResolvedValue({ valid: false });
    renderAt("?token=stale");

    expect(await screen.findByTestId("page-state-empty")).toHaveTextContent("邀请无效");
    expect(screen.queryByTestId("accept-confirm")).not.toBeInTheDocument();
  });

  it("reports a resolve network failure as an error, not as an invalid invite", async () => {
    mockedApi.resolveInvite.mockRejectedValue(new Error("boom"));
    renderAt("?token=tok-abc");

    expect(await screen.findByTestId("page-state-error")).toHaveTextContent("无法读取");
    // Critically: it must NOT tell the user their invite is dead when we simply
    // could not ask.
    expect(screen.queryByText(/邀请无效/)).not.toBeInTheDocument();
  });

  it("falls back to the username when no display name is present", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved({ inviterDisplayName: null }));
    renderAt("?token=tok-abc");

    expect(await screen.findByTestId("accept-inviter")).toHaveTextContent("alice");
  });

  it("never renders an empty inviter name", async () => {
    // Map.of() can omit both keys, so both may be absent.
    mockedApi.resolveInvite.mockResolvedValue({ valid: true });
    renderAt("?token=tok-abc");

    expect(await screen.findByTestId("accept-inviter")).toHaveTextContent("一位创作者");
  });

  it("says 已确认邀请 — not 已加入协作 — after accepting", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    mockedApi.acceptInvite.mockResolvedValue(accepted());
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));

    const headline = await screen.findByTestId("accept-headline");
    expect(headline).toHaveTextContent("已确认");
    expect(headline).not.toHaveTextContent("加入");
    expect(document.body.textContent).not.toContain("已接受协作邀请");
  });

  it("repeats the boundary note on the success view", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    mockedApi.acceptInvite.mockResolvedValue(accepted());
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));

    expect(await screen.findByTestId("accept-boundary")).toHaveTextContent(
      "不会因此获得任何协作权限",
    );
  });

  it("links to /u/:username — never Legacy's /u/:username/works", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    mockedApi.acceptInvite.mockResolvedValue(accepted());
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));
    await screen.findByTestId("accept-headline");

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href") ?? "");
    const profile = hrefs.find((h) => h.startsWith("/u/"));
    expect(profile).toBe("/u/alice");
    for (const href of hrefs) {
      expect(href).not.toContain("/works");
    }
  });

  it("hides the profile link when the username is unknown", async () => {
    mockedApi.resolveInvite.mockResolvedValue({ valid: true });
    mockedApi.acceptInvite.mockResolvedValue({ accepted: true });
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));
    await screen.findByTestId("accept-headline");

    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href") ?? "");
    // No /u/undefined.
    expect(hrefs.some((h) => h.startsWith("/u/"))).toBe(false);
  });

  it("explains a 409 self-invite instead of showing a generic error", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved({ inviterUsername: "me" }));
    // Must be a real ApiError — the page branches on `instanceof ApiError`.
    mockedApi.acceptInvite.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 409,
        detail: "不能接受自己的邀请",
        code: "CONFLICT",
      }),
    );
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));

    expect(await screen.findByTestId("accept-error")).toHaveTextContent("你自己发出的邀请");
  });

  it("tells a guest to log in when accept returns 401", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    mockedApi.acceptInvite.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 401,
        detail: "",
        code: "UNAUTHORIZED",
      }),
    );
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));

    expect(await screen.findByTestId("accept-error")).toHaveTextContent("请先登录");
  });

  it("does not call accept before the user presses the button", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    renderAt("?token=tok-abc");

    await screen.findByTestId("accept-confirm");
    expect(mockedApi.acceptInvite).not.toHaveBeenCalled();
  });

  it("sends the token to accept verbatim", async () => {
    mockedApi.resolveInvite.mockResolvedValue(resolved());
    mockedApi.acceptInvite.mockResolvedValue(accepted());
    renderAt("?token=tok-abc");

    fireEvent.click(await screen.findByTestId("accept-confirm"));

    await waitFor(() => {
      expect(mockedApi.acceptInvite).toHaveBeenCalledWith("tok-abc");
    });
  });
});
