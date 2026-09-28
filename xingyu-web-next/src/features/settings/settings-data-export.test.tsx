import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { accountApi } from "@/api/account/account.api";
import { SettingsDataExportPage } from "./pages/SettingsDataExportPage";

vi.mock("@/api/account/account.api", () => ({
  accountApi: {
    reAuthenticate: vi.fn(),
    changeEmail: vi.fn(),
    getDataExport: vi.fn(),
    requestAccountDeletion: vi.fn(),
  },
}));

const mocked = vi.mocked(accountApi);

function renderPage() {
  return render(<SettingsDataExportPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom lacks these; the download path needs them.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("SettingsDataExportPage", () => {
  it("does not fetch on mount — the user asks for the export", async () => {
    renderPage();
    expect(mocked.getDataExport).not.toHaveBeenCalled();
    expect(screen.getByTestId("export-load")).toBeInTheDocument();
  });

  it("states the 200-row cap up front", () => {
    renderPage();
    expect(screen.getByTestId("export-limit-note")).toHaveTextContent("200 条");
  });

  it("fetches and previews the sections the backend sends", async () => {
    mocked.getDataExport.mockResolvedValue({
      exportedAt: "2026-09-28T10:00:00Z",
      profile: { username: "tester" },
      articles: [{}, {}, {}],
      likes: [{}],
    });
    renderPage();
    fireEvent.click(screen.getByTestId("export-load"));
    const sections = await screen.findByTestId("export-sections");
    expect(sections).toHaveTextContent("个人资料");
    expect(sections).toHaveTextContent("我的文章");
    expect(sections).toHaveTextContent("3 条");
    expect(sections).toHaveTextContent("我的点赞");
    expect(sections).toHaveTextContent("1 条");
  });

  it("offers a download once the payload is loaded", async () => {
    mocked.getDataExport.mockResolvedValue({ exportedAt: "2026-09-28T10:00:00Z" });
    renderPage();
    fireEvent.click(screen.getByTestId("export-load"));
    expect(await screen.findByTestId("export-download")).toBeInTheDocument();
  });

  it("triggers a client-side JSON download", async () => {
    mocked.getDataExport.mockResolvedValue({ exportedAt: "2026-09-28T10:00:00Z" });
    renderPage();
    fireEvent.click(screen.getByTestId("export-load"));
    await screen.findByTestId("export-download");
    fireEvent.click(screen.getByTestId("export-download"));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("shows an error state with a retry when the export fails", async () => {
    mocked.getDataExport.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    fireEvent.click(screen.getByTestId("export-load"));
    expect(await screen.findByTestId("export-error")).toHaveTextContent("请先登录");
    expect(screen.getByTestId("export-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("export-download")).not.toBeInTheDocument();
  });

  it("retries successfully after a failure", async () => {
    mocked.getDataExport
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ exportedAt: "2026-09-28T10:00:00Z" });
    renderPage();
    fireEvent.click(screen.getByTestId("export-load"));
    await screen.findByTestId("export-retry");
    fireEvent.click(screen.getByTestId("export-retry"));
    await waitFor(() => expect(screen.getByTestId("export-download")).toBeInTheDocument());
  });

  it("does not offer a fake server-side job or file link", () => {
    renderPage();
    // There is no server-side export job/zip endpoint — only a JSON body.
    expect(screen.queryByText(/导出任务/)).not.toBeInTheDocument();
    expect(screen.queryByText(/下载链接/)).not.toBeInTheDocument();
  });
});
