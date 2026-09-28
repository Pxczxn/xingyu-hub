import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type { CollaborationInvite } from "@/api/collaboration/collaboration.types";
import { CollaborationInvitePage } from "./CollaborationInvitePage";

/*
 * /studio/collaboration — 创建邀请 (Phase 2M).
 *
 * The assertions that matter:
 *   1. the boundary disclosure is present BEFORE the link is sent;
 *   2. the copied/displayed URL is ABSOLUTE (the backend returns a relative path);
 *   3. a clipboard failure is surfaced, not silently swallowed;
 *   4. no link to a "collaborator list" or Legacy's dead /u/:username/works.
 */

vi.mock("@/api/collaboration/collaboration.api", () => ({
  collaborationApi: {
    createInvite: vi.fn(),
    resolveInvite: vi.fn(),
    acceptInvite: vi.fn(),
  },
}));

const mockedApi = vi.mocked(collaborationApi);

function invite(overrides: Partial<CollaborationInvite> = {}): CollaborationInvite {
  return {
    id: "inv1",
    token: "tok-abc",
    inviteUrl: "/studio/collaboration/accept?token=tok-abc",
    note: null,
    expiresAt: "2026-10-05T10:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/studio/collaboration"]}>
      <Routes>
        <Route path="/studio/collaboration" element={<CollaborationInvitePage />} />
        <Route path="/studio" element={<p>创作中心</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("collaboration invite page", () => {
  it("shows the capability boundary before anything is created", () => {
    renderPage();
    expect(screen.getByTestId("collaboration-boundary")).toHaveTextContent(
      "不会因此获得任何协作权限",
    );
  });

  it("creates an invite and shows an ABSOLUTE url", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));

    const link = await screen.findByTestId("collaboration-link");
    // window.location.origin is prefixed — a bare path is not a shareable link.
    expect(link.textContent).toContain("/studio/collaboration/accept?token=tok-abc");
    expect(link.textContent).toMatch(/^https?:\/\//);
  });

  it("sends a trimmed note, and omits a blank one", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.change(screen.getByTestId("collaboration-note"), {
      target: { value: "  一起写吧  " },
    });
    fireEvent.click(screen.getByTestId("collaboration-create"));

    await waitFor(() => {
      expect(mockedApi.createInvite).toHaveBeenCalledWith("一起写吧");
    });
  });

  it("omits the note entirely when it is only whitespace", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.change(screen.getByTestId("collaboration-note"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("collaboration-create"));

    await waitFor(() => {
      expect(mockedApi.createInvite).toHaveBeenCalledWith(undefined);
    });
  });

  it("restates the boundary next to the generated link", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));
    const result = await screen.findByTestId("collaboration-result");

    expect(result).toHaveTextContent("不会因此获得任何协作权限");
  });

  it("copies the absolute url to the clipboard", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));
    await screen.findByTestId("collaboration-link");
    fireEvent.click(screen.getByTestId("collaboration-copy"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText.mock.calls[0][0]).toMatch(/^https?:\/\//);
    expect(await screen.findByText("已复制到剪贴板。")).toBeInTheDocument();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("surfaces a clipboard failure instead of pretending it worked", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });

    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));
    await screen.findByTestId("collaboration-link");
    fireEvent.click(screen.getByTestId("collaboration-copy"));

    expect(await screen.findByRole("alert")).toHaveTextContent("复制失败");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("reports a creation failure rather than showing a bogus link", async () => {
    mockedApi.createInvite.mockRejectedValue(new Error("boom"));
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));

    expect(await screen.findByTestId("collaboration-error")).toBeInTheDocument();
    expect(screen.queryByTestId("collaboration-link")).not.toBeInTheDocument();
  });

  it("says the session expired on a 401", async () => {
    // NOTE: the page branches on `instanceof ApiError`, so the rejection must be
    // a REAL ApiError instance — an Error with a `problem` property attached is
    // not enough and would silently fall through to the generic branch.
    mockedApi.createInvite.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "",
        status: 401,
        detail: "",
        code: "UNAUTHORIZED",
      }),
    );
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));

    expect(await screen.findByTestId("collaboration-error")).toHaveTextContent("登录状态已过期");
  });

  it("lets the user start over", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));
    await screen.findByTestId("collaboration-result");
    fireEvent.click(screen.getByTestId("collaboration-reset"));

    expect(screen.queryByTestId("collaboration-result")).not.toBeInTheDocument();
  });

  it("does not link to a collaborator list or Legacy's dead works url", async () => {
    renderPage();
    const links = screen.getAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      // No collaborator page exists in the backend; no /u/:username/works route
      // exists in V2. Either link would be a dead end.
      expect(href).not.toContain("/works");
      expect(href).not.toMatch(/collaborator/);
    }
  });

  it("never claims the invite grants collaboration", async () => {
    mockedApi.createInvite.mockResolvedValue(invite());
    renderPage();

    fireEvent.click(screen.getByTestId("collaboration-create"));
    await screen.findByTestId("collaboration-result");

    const text = document.body.textContent ?? "";
    // "已加入协作" is Legacy's wording; it must not appear here.
    expect(text).not.toContain("已加入协作");
    expect(text).not.toContain("协作空间");
  });
});
