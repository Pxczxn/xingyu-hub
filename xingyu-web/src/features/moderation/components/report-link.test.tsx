import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReportLink } from "./ReportLink";

/*
 * The lightweight report entry placed on content.
 *
 * The two things worth pinning: it carries only structured target context (never
 * a title/author), and a guest gets nothing because the report write endpoint is
 * authed.
 */

const mockUseAuth = vi.fn();

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderLink(props: Partial<Parameters<typeof ReportLink>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ReportLink objectType="MOMENT" objectId="m-1" {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { username: "alice" } });
});

describe("ReportLink", () => {
  it("links to the report route with only type and id", () => {
    renderLink();
    expect(screen.getByRole("link", { name: "举报这条内容" })).toHaveAttribute(
      "href",
      "/reports/new?objectType=MOMENT&objectId=m-1",
    );
  });

  it("encodes the id", () => {
    renderLink({ objectId: "a/b c" });
    expect(screen.getByRole("link", { name: "举报这条内容" })).toHaveAttribute(
      "href",
      "/reports/new?objectType=MOMENT&objectId=a%2Fb%20c",
    );
  });

  it("renders nothing for a guest", () => {
    // Guests cannot file a report (the write endpoint is authed), so the link
    // would lead straight to a 401.
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null });
    renderLink();
    expect(screen.queryByRole("link", { name: "举报这条内容" })).not.toBeInTheDocument();
  });

  it("renders nothing when explicitly hidden (own content)", () => {
    renderLink({ hidden: true });
    expect(screen.queryByRole("link", { name: "举报这条内容" })).not.toBeInTheDocument();
  });

  it("renders nothing without an id", () => {
    renderLink({ objectId: "" });
    expect(screen.queryByRole("link", { name: "举报这条内容" })).not.toBeInTheDocument();
  });
});
