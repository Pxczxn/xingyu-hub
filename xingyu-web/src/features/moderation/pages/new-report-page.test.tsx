import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { NewReportPage } from "./NewReportPage";

const mockedSubmit = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  reportsApi: {
    submit: (...args: unknown[]) => mockedSubmit(...args),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reports/new"]}>
      <Routes>
        <Route path="/reports/new" element={<NewReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NewReportPage", () => {
  it("renders the three required fields", () => {
    renderPage();
    expect(screen.getByLabelText("对象类型")).toBeInTheDocument();
    expect(screen.getByLabelText("对象 ID")).toBeInTheDocument();
    expect(screen.getByLabelText("举报原因")).toBeInTheDocument();
  });

  it("submits objectType/objectId/reason and navigates to the new report", async () => {
    mockedSubmit.mockResolvedValue({ reportId: "r-new", id: "r-new", status: "SUBMITTED" });
    renderPage();

    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        objectType: "ARTICLE",
        objectId: "a1",
        reason: "SPAM",
      })
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/reports/r-new"));
  });

  it("omits detail when the textarea is empty", async () => {
    mockedSubmit.mockResolvedValue({ reportId: "r1", id: "r1", status: "SUBMITTED" });
    renderPage();
    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    const [payload] = mockedSubmit.mock.calls[0] as [Record<string, unknown>];
    expect("detail" in payload).toBe(false);
  });

  it("includes detail when the user typed one", async () => {
    mockedSubmit.mockResolvedValue({ reportId: "r1", id: "r1", status: "SUBMITTED" });
    renderPage();
    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "a1" } });
    fireEvent.change(screen.getByLabelText("补充说明"), { target: { value: "详细描述" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ detail: "详细描述" })
      )
    );
  });

  it("lets the user change the object type", async () => {
    mockedSubmit.mockResolvedValue({ reportId: "r1", id: "r1", status: "SUBMITTED" });
    renderPage();
    fireEvent.change(screen.getByLabelText("对象类型"), { target: { value: "MOMENT" } });
    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "m1" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ objectType: "MOMENT" })
      )
    );
  });

  it("rejects a submission with a blank object id, without calling the API", async () => {
    // Handler-level re-check: `disabled` alone would not stop an implicit submit.
    renderPage();
    fireEvent.submit(screen.getByRole("button", { name: "提交举报" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "请填写对象类型、对象 ID 与举报原因。"
    );
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it("shows the server detail and does not navigate when the submit fails", async () => {
    mockedSubmit.mockRejectedValue(problem(400, "INVALID_FIELD", "对象标识不能为空"));
    renderPage();
    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("对象标识不能为空");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps the typed object id after a failure", async () => {
    mockedSubmit.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
    renderPage();
    fireEvent.change(screen.getByLabelText("对象 ID"), { target: { value: "keep-me" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    expect((screen.getByLabelText("对象 ID") as HTMLInputElement).value).toBe("keep-me");
  });

  it("offers a cancel link back to the list", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "取消" })).toHaveAttribute("href", "/reports");
  });
});

