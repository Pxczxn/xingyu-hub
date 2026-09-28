import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/client";
import { apiTokensApi } from "@/api/settings/api-tokens.api";
import type { ApiTokenSummary } from "@/api/settings/api-tokens.types";
import { SettingsApiTokensPage } from "./pages/SettingsApiTokensPage";
/*
 * /settings/api-tokens — list / create / one-time secret / copy / revoke (2A-2b).
 *
 * Real contract (verified live 2026-09-23):
 *   GET    /me/api-tokens        -> bare array; revoked rows are still listed
 *   POST   /me/api-tokens        -> the secret, exactly once
 *   DELETE /me/api-tokens/{id}   -> 204 (idempotent)
 *
 * The secret in these tests is an obvious fake and is never a credential.
 */

vi.mock("@/api/settings/api-tokens.api", () => ({
  apiTokensApi: { list: vi.fn(), create: vi.fn(), revoke: vi.fn() },
}));

const mockedList = vi.mocked(apiTokensApi.list);
const mockedCreate = vi.mocked(apiTokensApi.create);
const mockedRevoke = vi.mocked(apiTokensApi.revoke);

const FAKE_SECRET = "xy_FAKE_1111111111111111111111111111111111111111111111111111111111";
const FAKE_SECRET_2 = "xy_FAKE_2222222222222222222222222222222222222222222222222222222222";

function token(overrides: Partial<ApiTokenSummary> = {}): ApiTokenSummary {
  return {
    id: "t-1",
    name: "CI 同步",
    tokenPrefix: "xy_abcd1234",
    scopes: ["read:profile", "read:articles"],
    status: "ACTIVE",
    lastUsedAt: null,
    createdAt: "2026-09-23T15:05:34Z",
    ...overrides,
  };
}

function problem(status: number, code: string, detail: string): ApiError {
  return new ApiError({ type: "about:blank", title: detail, status, detail, code });
}

/** Counts occurrences of a value in the rendered text — used to prove the
 *  secret exists in exactly one place (the create-success panel). */
function occurrencesOf(value: string): number {
  return (document.body.textContent ?? "").split(value).length - 1;
}

beforeEach(() => {
  mockedList.mockReset();
  mockedCreate.mockReset();
  mockedRevoke.mockReset();
});

describe("SettingsApiTokensPage — list", () => {
  it("renders the safe metadata of each token", async () => {
    mockedList.mockResolvedValue([
      token(),
      token({
        id: "t-2",
        name: "CI 备份",
        tokenPrefix: "xy_efgh5678",
        lastUsedAt: "2026-09-23T16:00:00Z",
      }),
    ]);

    render(<SettingsApiTokensPage />);

    expect(await screen.findByTestId("api-token-list")).toBeInTheDocument();
    expect(screen.getByText("CI 同步")).toBeInTheDocument();
    expect(screen.getByTestId("api-token-prefix-t-1")).toHaveTextContent("xy_abcd1234");
    expect(screen.getByTestId("api-token-created-t-1")).toBeInTheDocument();
    // Never used -> explicit placeholder, not an empty cell.
    expect(screen.getByTestId("api-token-lastused-t-1")).toHaveTextContent("从未使用");
    expect(screen.getByTestId("api-token-lastused-t-2")).not.toHaveTextContent("从未使用");
  });

  it("shows an empty state when there are no tokens", async () => {
    mockedList.mockResolvedValue([]);

    render(<SettingsApiTokensPage />);

    expect(await screen.findByText("还没有创建任何 Token")).toBeInTheDocument();
  });

  it("shows an error state and can retry", async () => {
    mockedList.mockRejectedValueOnce(problem(500, "INTERNAL_ERROR", "boom"));
    mockedList.mockResolvedValueOnce([token()]);

    render(<SettingsApiTokensPage />);

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByTestId("api-token-list")).toBeInTheDocument();
  });

  it("keeps revoked tokens visible, badged, with no revoke action", async () => {
    mockedList.mockResolvedValue([token({ id: "t-9", status: "REVOKED" })]);

    render(<SettingsApiTokensPage />);

    expect(await screen.findByTestId("api-token-status-t-9")).toHaveTextContent("已撤销");
    expect(screen.queryByTestId("api-token-revoke-t-9")).not.toBeInTheDocument();
  });

  it("never renders a secret for a listed token", async () => {
    mockedList.mockResolvedValue([token()]);

    render(<SettingsApiTokensPage />);

    await screen.findByTestId("api-token-list");
    expect(occurrencesOf(FAKE_SECRET)).toBe(0);
  });
});

describe("SettingsApiTokensPage — create + one-time secret", () => {
  it("shows the secret exactly once after a successful create", async () => {
    mockedList.mockResolvedValueOnce([]).mockResolvedValueOnce([token()]);
    mockedCreate.mockResolvedValue({
      id: "t-1",
      name: "CI 同步",
      token: FAKE_SECRET,
      scopes: ["read:profile", "read:articles"],
    });

    render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");

    await userEvent.type(screen.getByLabelText("名称"), "CI 同步");
    await userEvent.click(screen.getByTestId("api-token-create-submit"));

    expect(await screen.findByTestId("api-token-secret-panel")).toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledWith("CI 同步");
    // Present once — and only in the panel.
    expect(occurrencesOf(FAKE_SECRET)).toBe(1);
    expect(screen.getByTestId("api-token-secret-value")).toHaveTextContent(FAKE_SECRET);
  });

  it("drops the secret from the UI when the panel is dismissed", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({
      id: "t-1",
      name: "CI",
      token: FAKE_SECRET,
      scopes: [],
    });

    render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");
    await userEvent.type(screen.getByLabelText("名称"), "CI");
    await userEvent.click(screen.getByTestId("api-token-create-submit"));
    await screen.findByTestId("api-token-secret-panel");

    await userEvent.click(screen.getByTestId("api-token-dismiss"));

    expect(screen.queryByTestId("api-token-secret-panel")).not.toBeInTheDocument();
    expect(occurrencesOf(FAKE_SECRET)).toBe(0);
  });

  it("cannot bring the secret back by reloading the list", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({ id: "t-1", name: "CI", token: FAKE_SECRET, scopes: [] });

    render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");
    await userEvent.type(screen.getByLabelText("名称"), "CI");
    await userEvent.click(screen.getByTestId("api-token-create-submit"));
    await screen.findByTestId("api-token-secret-panel");
    await userEvent.click(screen.getByTestId("api-token-dismiss"));

    // A second create would show a NEW secret, never the old one.
    mockedCreate.mockResolvedValue({ id: "t-2", name: "CI2", token: FAKE_SECRET_2, scopes: [] });
    await userEvent.type(screen.getByLabelText("名称"), "CI2");
    await userEvent.click(screen.getByTestId("api-token-create-submit"));
    await screen.findByTestId("api-token-secret-panel");

    expect(occurrencesOf(FAKE_SECRET)).toBe(0);
    expect(occurrencesOf(FAKE_SECRET_2)).toBe(1);
  });

  it("sends only one request when submit is fired twice", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({ id: "t-1", name: "CI", token: FAKE_SECRET, scopes: [] });

    const { container } = render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");
    await userEvent.type(screen.getByLabelText("名称"), "CI");

    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await screen.findByTestId("api-token-secret-panel");
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it("shows no token at all when create fails", async () => {
    mockedList.mockResolvedValue([]);
    mockedCreate.mockRejectedValue(problem(500, "INTERNAL_ERROR", "系统繁忙，请稍后再试"));

    render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");
    await userEvent.type(screen.getByLabelText("名称"), "CI");
    await userEvent.click(screen.getByTestId("api-token-create-submit"));

    expect(await screen.findByTestId("api-token-create-error")).toHaveTextContent("系统繁忙");
    expect(screen.queryByTestId("api-token-secret-panel")).not.toBeInTheDocument();
    expect(occurrencesOf(FAKE_SECRET)).toBe(0);
  });

  it("rejects a blank name in the submit handler without calling the API", async () => {
    mockedList.mockResolvedValue([]);

    const { container } = render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");

    // Bypasses the button's disabled state on purpose (SKILL §7d).
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByTestId("api-token-name-error")).toHaveTextContent("请填写");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects a name past the backend column limit instead of letting it 500", async () => {
    mockedList.mockResolvedValue([]);

    const { container } = render(<SettingsApiTokensPage />);
    await screen.findByText("还没有创建任何 Token");

    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "a".repeat(129) } });
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByTestId("api-token-name-error")).toHaveTextContent("128");
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("SettingsApiTokensPage — revoke", () => {
  it("requires a confirmation before revoking", async () => {
    mockedList.mockResolvedValue([token()]);

    render(<SettingsApiTokensPage />);
    await screen.findByTestId("api-token-list");

    await userEvent.click(screen.getByTestId("api-token-revoke-t-1"));

    expect(await screen.findByTestId("api-token-confirm-revoke-t-1")).toBeInTheDocument();
    expect(mockedRevoke).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    mockedList.mockResolvedValue([token()]);

    render(<SettingsApiTokensPage />);
    await screen.findByTestId("api-token-list");

    await userEvent.click(screen.getByTestId("api-token-revoke-t-1"));
    await userEvent.click(screen.getByTestId("api-token-cancel-revoke-t-1"));

    expect(screen.queryByTestId("api-token-confirm-revoke-t-1")).not.toBeInTheDocument();
    expect(mockedRevoke).not.toHaveBeenCalled();
  });

  it("revokes then re-reads the real list", async () => {
    mockedList.mockResolvedValueOnce([token()]).mockResolvedValueOnce([token({ status: "REVOKED" })]);
    mockedRevoke.mockResolvedValue(undefined);

    render(<SettingsApiTokensPage />);
    await screen.findByTestId("api-token-list");

    await userEvent.click(screen.getByTestId("api-token-revoke-t-1"));
    await userEvent.click(screen.getByTestId("api-token-confirm-revoke-t-1"));

    expect(mockedRevoke).toHaveBeenCalledWith("t-1");
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("api-token-status-t-1")).toHaveTextContent("已撤销");
  });

  it("keeps the list untouched when revoke fails", async () => {
    mockedList.mockResolvedValue([token()]);
    mockedRevoke.mockRejectedValue(problem(404, "NOT_FOUND", "资源不存在"));

    render(<SettingsApiTokensPage />);
    await screen.findByTestId("api-token-list");

    await userEvent.click(screen.getByTestId("api-token-revoke-t-1"));
    await userEvent.click(screen.getByTestId("api-token-confirm-revoke-t-1"));

    expect(await screen.findByTestId("api-token-action-error")).toHaveTextContent("资源不存在");
    // Still ACTIVE-looking: no optimistic removal, no fake success.
    expect(screen.getByText("CI 同步")).toBeInTheDocument();
    expect(screen.queryByTestId("api-token-status-t-1")).not.toBeInTheDocument();
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("sends only one DELETE when the confirmation is clicked twice", async () => {
    mockedList.mockResolvedValue([token()]);
    mockedRevoke.mockResolvedValue(undefined);

    render(<SettingsApiTokensPage />);
    await screen.findByTestId("api-token-list");

    await userEvent.click(screen.getByTestId("api-token-revoke-t-1"));
    const confirm = await screen.findByTestId("api-token-confirm-revoke-t-1");
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledTimes(1));
  });
});
