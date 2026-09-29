import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { NewAppealPage } from "./NewAppealPage";

const mockedSubmit = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  appealsApi: {
    submit: (...args: unknown[]) => mockedSubmit(...args),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/appeals/new${search}`]}>
      <Routes>
        <Route path="/appeals/new" element={<NewAppealPage />} />
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

describe("NewAppealPage — without a case or measure", () => {
  it("does NOT render the form when no caseId or measureId is present", () => {
    // Nothing the user could type would succeed: the server needs an
    // appealable measure. So the form is withheld rather than always failing.
    renderAt("");
    expect(screen.queryByLabelText("申诉说明")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交申诉" })).not.toBeInTheDocument();
  });

  it("explains why and points at the reports page", () => {
    renderAt("");
    expect(screen.getByText("没有可申诉的处置")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看我的举报" })).toHaveAttribute(
      "href",
      "/reports"
    );
  });

  it("never calls the API in that state", () => {
    renderAt("");
    expect(mockedSubmit).not.toHaveBeenCalled();
  });
});

describe("NewAppealPage — with a case/measure", () => {
  it("renders the form when a measureId is present", () => {
    renderAt("?caseId=case-1&measureId=meas-1");
    expect(screen.getByLabelText("申诉说明")).toBeInTheDocument();
  });

  it("renders the form when only a caseId is present", () => {
    renderAt("?caseId=case-1");
    expect(screen.getByLabelText("申诉说明")).toBeInTheDocument();
  });

  it("shows the carried case id", () => {
    renderAt("?caseId=case-xyz&measureId=meas-1");
    expect(screen.getByText("case-xyz")).toBeInTheDocument();
  });

  it("submits both measureId and caseId when both are present", async () => {
    mockedSubmit.mockResolvedValue({ id: "ap-new", status: "SUBMITTED" });
    renderAt("?caseId=case-1&measureId=meas-1");

    fireEvent.change(screen.getByLabelText("申诉说明"), { target: { value: "请求复核" } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        measureId: "meas-1",
        caseId: "case-1",
        detail: "请求复核",
      })
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/appeals/ap-new"));
  });

  it("omits measureId when only a caseId was supplied", async () => {
    // The server resolves the measure from the case when measureId is absent,
    // so sending a bogus empty measureId would be wrong.
    mockedSubmit.mockResolvedValue({ id: "ap-new", status: "SUBMITTED" });
    renderAt("?caseId=case-1");

    fireEvent.change(screen.getByLabelText("申诉说明"), { target: { value: "理由" } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    const [payload] = mockedSubmit.mock.calls[0] as [Record<string, unknown>];
    expect("measureId" in payload).toBe(false);
    expect(payload.caseId).toBe("case-1");
  });

  it("refuses a blank explanation without calling the API", async () => {
    renderAt("?caseId=case-1&measureId=meas-1");
    fireEvent.submit(screen.getByRole("button", { name: "提交申诉" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("请填写申诉说明。");
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it("refuses a whitespace-only explanation", async () => {
    renderAt("?caseId=case-1&measureId=meas-1");
    fireEvent.change(screen.getByLabelText("申诉说明"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it("surfaces the server field error and does not navigate", async () => {
    mockedSubmit.mockRejectedValue(problem(400, "INVALID_FIELD", "未找到可申诉的治理措施"));
    renderAt("?caseId=case-1&measureId=meas-1");

    fireEvent.change(screen.getByLabelText("申诉说明"), { target: { value: "理由" } });
    fireEvent.click(screen.getByRole("button", { name: "提交申诉" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("未找到可申诉的治理措施");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("offers a cancel link back to the appeal list", () => {
    renderAt("?caseId=case-1&measureId=meas-1");
    expect(screen.getByRole("link", { name: "取消" })).toHaveAttribute("href", "/appeals");
  });
});

