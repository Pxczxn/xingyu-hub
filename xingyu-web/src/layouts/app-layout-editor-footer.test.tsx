import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";

vi.mock("@/features/chat/chat-socket.context", () => ({
  useChatSocket: () => ({
    subscribe: () => () => {},
    myUserId: null,
  }),
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn() }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<div>页面</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout editor footer", () => {
  it("keeps the site footer on a community page", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: "站点信息" })).toBeInTheDocument();
  });

  it("keeps the site footer on the content list and on version history", () => {
    const { unmount } = renderAt("/studio/content");
    expect(screen.getByRole("navigation", { name: "站点信息" })).toBeInTheDocument();
    unmount();

    renderAt("/studio/content/article-1/versions");
    expect(screen.getByRole("navigation", { name: "站点信息" })).toBeInTheDocument();
  });

  it("omits the site footer on the editor route, including a new draft", () => {
    const { unmount } = renderAt("/studio/content/article-1");
    expect(screen.queryByRole("navigation", { name: "站点信息" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "星语" })).toBeInTheDocument();
    unmount();

    renderAt("/studio/content/new");
    expect(screen.queryByRole("navigation", { name: "站点信息" })).not.toBeInTheDocument();
  });
});
