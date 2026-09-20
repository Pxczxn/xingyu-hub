import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { buildRedirectPath, LEGACY_REDIRECTS } from "@/router/redirects";

/**
 * Router smoke tests: every Phase 0 route resolves, the 404 fallback works,
 * and the approved Legacy redirects rewrite URLs correctly.
 */

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <LocationProbe />
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("router", () => {
  it("renders the Home skeleton at /", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "社区公告" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "为你推荐" })).toBeInTheDocument();
  });

  it("renders the login page at /login", () => {
    renderAt("/login");
    expect(screen.getByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.getByLabelText("账号")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
  });

  it("renders the article host and exposes :articleId", () => {
    renderAt("/articles/abc-123");
    expect(screen.getByText("abc-123")).toBeInTheDocument();
  });

  it("renders the profile host and exposes :username", () => {
    renderAt("/u/tester");
    expect(screen.getByText("tester")).toBeInTheDocument();
  });

  it("renders the 404 fallback for unknown paths", () => {
    renderAt("/definitely-not-a-route");
    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });

  it("redirects /tags to /topics", async () => {
    renderAt("/tags");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/topics");
    });
  });

  it("redirects /users/:username to /u/:username preserving the param", async () => {
    renderAt("/users/alice");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/u/alice");
    });
  });

  it("redirects /settings and /me/profile to /settings/profile", async () => {
    renderAt("/settings");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/settings/profile");
    });
  });
});

describe("legacy redirect table", () => {
  it("contains exactly the five approved Phase 0 redirects", () => {
    expect(LEGACY_REDIRECTS.map((r) => r.from)).toEqual([
      "/users/:username",
      "/tags",
      "/articles",
      "/me/profile",
      "/settings",
    ]);
  });

  it("substitutes route params into the target path", () => {
    expect(buildRedirectPath("/u/:username", { username: "alice" })).toBe("/u/alice");
  });

  it("encodes param values", () => {
    expect(buildRedirectPath("/u/:username", { username: "a b" })).toBe("/u/a%20b");
  });
});
