import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { setStoredToken } from "@/lib/storage";

/*
 * Phase 3H routing: account security + data sovereignty.
 *
 *   /settings/security/email              email change (needs a re-auth grant)
 *   /settings/security/re-authenticate    mints the grant
 *   /settings/data/export                 JSON data export
 *   /settings/data/delete-account         account deactivation
 *
 * All four are RequireAuth and all four live under the shared SettingsLayout,
 * so the settings nav must be present on each page. Guards + import health only
 * — the per-page behaviour is covered by the feature tests.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({
      email: "tester@pxczxn.top",
      emailVerified: true,
      mustChangePassword: false,
    })),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
  },
}));

vi.mock("@/api/account/account.api", () => ({
  accountApi: {
    reAuthenticate: vi.fn(),
    changeEmail: vi.fn(),
    getDataExport: vi.fn(),
    requestAccountDeletion: vi.fn(),
  },
}));

vi.mock("@/api/home/home.api", () => ({
  homeApi: {
    getGuestHome: vi.fn(async () => ({
      unreadNotifications: 0,
      continueReading: [],
      followingUpdates: [],
      discoveries: [],
    })),
    getMyHome: vi.fn(async () => ({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [],
    })),
    getAnnouncements: vi.fn(async () => []),
  },
}));

function renderAt(path: string, signedIn: boolean) {
  if (signedIn) setStoredToken("test-token");
  else localStorage.clear();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("phase 3H settings routes", () => {
  it("routes /settings/security/re-authenticate to the re-auth page", async () => {
    renderAt("/settings/security/re-authenticate", true);
    expect(await screen.findByRole("heading", { name: "身份再验证" })).toBeInTheDocument();
  });

  it("routes /settings/security/email to the email page", async () => {
    renderAt("/settings/security/email", true);
    expect(await screen.findByRole("heading", { name: "修改邮箱" })).toBeInTheDocument();
  });

  it("routes /settings/data/export to the export page", async () => {
    renderAt("/settings/data/export", true);
    expect(await screen.findByRole("heading", { name: "导出我的数据" })).toBeInTheDocument();
  });

  it("routes /settings/data/delete-account to the deactivation page", async () => {
    renderAt("/settings/data/delete-account", true);
    expect(await screen.findByRole("heading", { name: "停用账号" })).toBeInTheDocument();
  });

  it("shows the settings navigation on each new page", async () => {
    renderAt("/settings/data/export", true);
    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    expect(nav).toHaveTextContent("数据导出");
    expect(nav).toHaveTextContent("邮箱");
  });

  it("sends a GUEST to login from the email page", async () => {
    renderAt("/settings/security/email", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("sends a GUEST to login from the deactivation page", async () => {
    renderAt("/settings/data/delete-account", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    // The destructive screen must never render for an unauthenticated visitor.
    expect(screen.queryByTestId("delete-account-form")).not.toBeInTheDocument();
  });
});
