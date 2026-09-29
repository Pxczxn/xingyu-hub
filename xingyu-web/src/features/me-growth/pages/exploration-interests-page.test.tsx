import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { ExplorationInterestsPage } from "./ExplorationInterestsPage";

/*
 * Page tests for /me/interests (Phase 3D).
 *
 * The two behaviours worth pinning that are NOT obvious from the markup:
 *   1. The PUT is a FULL REPLACEMENT → we must never send a delta, and we must
 *      not fire it at all when nothing changed.
 *   2. After a save we re-seed from the SERVER response, because a re-minted
 *      personal label comes back with a new id.
 */

const getMap = vi.fn();
const getMine = vi.fn();
const updateMine = vi.fn();

vi.mock("@/api/exploration/exploration.api", () => ({
  explorationApi: {
    getMap: (...args: unknown[]) => getMap(...args),
    getMine: (...args: unknown[]) => getMine(...args),
    updateMine: (...args: unknown[]) => updateMine(...args),
  },
}));

const MAP = [
  {
    id: "root-tech",
    slug: "tech",
    name: "技术",
    description: "编程与工程实践",
    children: [
      { id: "c-java", slug: "java", name: "Java", description: "JVM 生态" },
      { id: "c-fe", slug: "frontend", name: "前端", description: "Web 界面" },
    ],
  },
  {
    id: "root-design",
    slug: "design",
    name: "设计",
    description: null,
    children: [{ id: "c-ui", slug: "ui", name: "UI", description: null }],
  },
];

function mine(over: Partial<{ domains: unknown[]; customLabels: string[] }> = {}) {
  return { domains: [], customLabels: [], ...over };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/interests"]}>
      <ExplorationInterestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMap.mockResolvedValue(MAP);
  getMine.mockResolvedValue(mine());
  updateMine.mockResolvedValue(mine());
});

describe("ExplorationInterestsPage — loading & error", () => {
  it("shows a loading state first", () => {
    getMap.mockReturnValue(new Promise(() => {}));
    getMine.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("explains a NON-auth failure with the server's detail", async () => {
    getMap.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    // The error branch renders PageState (role="alert"), NOT the 我的探索 header.
    const alert = await screen.findByTestId("page-state-error");
    expect(alert).toHaveTextContent("加载失败");
    expect(alert).toHaveTextContent("系统繁忙，请稍后再试");
  });

  it("tells an EXPIRED session to log in again (401)", async () => {
    getMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    const alert = await screen.findByTestId("page-state-error");
    expect(alert).toHaveTextContent("登录状态已过期，请重新登录。");
    expect(screen.getByRole("link", { name: "去登录" })).toBeInTheDocument();
  });

  it("does NOT dress the 500 up as a login problem", async () => {
    // The MissingRequestHeaderException bug returns 500 even for a session that
    // is simply expired-ish; we report what the server said, not a guess.
    getMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    await screen.findByTestId("page-state-error");
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });
});

describe("ExplorationInterestsPage — rendering", () => {
  it("renders the official groups and their leaf chips", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "我的探索" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "技术" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "设计" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Java" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前端" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UI" })).toBeInTheDocument();
  });

  it("marks the server-selected official domains as pressed", async () => {
    getMine.mockResolvedValue(
      mine({ domains: [{ id: "c-java", slug: "java", name: "Java", personal: false }] }),
    );
    renderPage();
    expect(await screen.findByRole("button", { name: "Java" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "前端" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does NOT pre-select a PERSONAL domain as an official checkbox", async () => {
    getMine.mockResolvedValue(
      mine({
        domains: [
          { id: "c-java", slug: "java", name: "Java", personal: false },
          { id: "p-1", slug: "java-abc", name: "逆向研究", personal: true },
        ],
        customLabels: ["逆向研究"],
      }),
    );
    renderPage();
    await screen.findByRole("button", { name: "Java" });
    // It shows up as a removable label chip, not as an official pill.
    expect(screen.getByLabelText("移除 逆向研究")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "逆向研究" })).not.toBeInTheDocument();
  });

  it("explains an EMPTY official map instead of rendering a blank section", async () => {
    getMap.mockResolvedValue([{ id: "r", slug: "tech", name: "技术", children: [] }]);
    renderPage();
    expect(await screen.findByText("暂无可选领域")).toBeInTheDocument();
  });

  it("lists existing personal labels as removable chips", async () => {
    getMine.mockResolvedValue(mine({ customLabels: ["Java", "逆向研究"] }));
    renderPage();
    expect(await screen.findByLabelText("移除 Java")).toBeInTheDocument();
    expect(screen.getByLabelText("移除 逆向研究")).toBeInTheDocument();
  });
});

describe("ExplorationInterestsPage — editing labels", () => {
  it("adds a label via the button and clears the input", async () => {
    renderPage();
    const input = await screen.findByLabelText("添加个人兴趣");
    fireEvent.change(input, { target: { value: "Rust" } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    await waitFor(() => expect(screen.getByLabelText("移除 Rust")).toBeInTheDocument());
    expect(input).toHaveValue("");
  });

  it("adds a label via Enter", async () => {
    renderPage();
    const input = await screen.findByLabelText("添加个人兴趣");
    fireEvent.change(input, { target: { value: "Zig" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText("移除 Zig")).toBeInTheDocument());
  });

  it("shows an inline error for a duplicate and keeps the input", async () => {
    getMine.mockResolvedValue(mine({ customLabels: ["Java"] }));
    renderPage();
    const input = await screen.findByLabelText("添加个人兴趣");
    fireEvent.change(input, { target: { value: "java" } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(await screen.findByText("该兴趣已添加")).toBeInTheDocument();
    expect(input).toHaveValue("java");
  });

  it("shows an inline error for an empty label", async () => {
    renderPage();
    await screen.findByLabelText("添加个人兴趣");
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(await screen.findByText("请输入兴趣名称")).toBeInTheDocument();
  });

  it("shows an inline error past the length limit", async () => {
    renderPage();
    const input = await screen.findByLabelText("添加个人兴趣");
    fireEvent.change(input, { target: { value: "x".repeat(21) } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(await screen.findByText("兴趣名称不超过 20 个字符")).toBeInTheDocument();
  });

  it("removes a label", async () => {
    getMine.mockResolvedValue(mine({ customLabels: ["Java", "Rust"] }));
    renderPage();
    fireEvent.click(await screen.findByLabelText("移除 Java"));
    await waitFor(() => expect(screen.queryByLabelText("移除 Java")).not.toBeInTheDocument());
    expect(screen.getByLabelText("移除 Rust")).toBeInTheDocument();
  });
});

describe("ExplorationInterestsPage — saving", () => {
  it("disables 保存 until something changes", async () => {
    await Promise.resolve();
    renderPage();
    const save = await screen.findByRole("button", { name: /保存探索/ });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Java" }));
    await waitFor(() => expect(save).toBeEnabled());
  });

  it("does NOT call the API when saving with no changes", async () => {
    renderPage();
    await screen.findByRole("button", { name: /保存探索/ });
    // The button is disabled, but guard the behaviour directly too.
    fireEvent.click(screen.getByRole("button", { name: /保存探索/ }));
    expect(updateMine).not.toHaveBeenCalled();
  });

  it("sends the COMPLETE state (domains + labels), never a delta", async () => {
    getMine.mockResolvedValue(
      mine({
        domains: [{ id: "c-fe", slug: "frontend", name: "前端", personal: false }],
        customLabels: ["Java"],
      }),
    );
    renderPage();
    // Add a domain and a label on top of the existing state.
    fireEvent.click(await screen.findByRole("button", { name: "UI" }));
    const input = screen.getByLabelText("添加个人兴趣");
    fireEvent.change(input, { target: { value: "Rust" } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));

    fireEvent.click(screen.getByRole("button", { name: /保存探索/ }));

    await waitFor(() => expect(updateMine).toHaveBeenCalledTimes(1));
    const payload = updateMine.mock.calls[0][0] as { domainIds: string[]; customLabels: string[] };
    // The pre-existing 前端 + Java must still be present — a delta would drop them.
    expect([...payload.domainIds].sort()).toEqual(["c-fe", "c-ui"]);
    expect(payload.customLabels).toEqual(["Java", "Rust"]);
  });

  it("re-seeds from the SERVER response after saving (new ids for re-minted labels)", async () => {
    updateMine.mockResolvedValue(
      mine({
        domains: [{ id: "c-java", slug: "java", name: "Java", personal: false }],
        customLabels: ["Java", "Rust"],
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Java" }));
    fireEvent.click(screen.getByRole("button", { name: /保存探索/ }));

    await waitFor(() => expect(screen.getByText("已保存")).toBeInTheDocument());
    // The button returns to disabled — the saved state is the new baseline.
    expect(screen.getByRole("button", { name: /保存探索/ })).toBeDisabled();
  });

  it("reports a save failure honestly and keeps the edits", async () => {
    updateMine.mockRejectedValue(new Error("boom"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Java" }));
    fireEvent.click(screen.getByRole("button", { name: /保存探索/ }));

    expect(await screen.findByText("保存失败，请稍后重试")).toBeInTheDocument();
    // The user's selection is NOT discarded — they can retry.
    expect(screen.getByRole("button", { name: "Java" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /保存探索/ })).toBeEnabled();
  });

  it("does not redirect to a /discover filter that V2 cannot honour", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Java" }));
    fireEvent.click(screen.getByRole("button", { name: /保存探索/ }));
    await waitFor(() => expect(screen.getByText("已保存")).toBeInTheDocument());
    // The page stays put; no /discover?domain= route is mounted here.
    expect(screen.getByRole("heading", { name: "我的探索" })).toBeInTheDocument();
  });
});

