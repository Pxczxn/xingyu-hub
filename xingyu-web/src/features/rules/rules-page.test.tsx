import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import { ApiError } from "@/api/client";
import { RulesPage } from "./pages/RulesPage";

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: { list: vi.fn(), getBySlug: vi.fn(), getCommunityRules: vi.fn() },
}));

const mocked = vi.mocked(guideApi);

const RULES = {
  id: "g2",
  slug: "community-rules",
  title: "社区公约",
  body: "请尊重他人、文明交流，不发布违法违规内容。举报与申诉机制可在治理中心查看。",
  publishedAt: "2026-09-18T20:33:57Z",
};

function unavailable(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderRules() {
  return render(
    <MemoryRouter initialEntries={["/rules"]}>
      <Routes>
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/guide" element={<p>指南目录</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RulesPage", () => {
  it("renders community-rules title and body without a fake chapter index", async () => {
    mocked.getCommunityRules.mockResolvedValue(RULES);
    renderRules();

    expect(await screen.findByRole("heading", { name: "社区公约" })).toBeInTheDocument();
    expect(screen.getByText(RULES.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看使用指南" })).toHaveAttribute("href", "/guide");

    expect(screen.queryByText("总则")).not.toBeInTheDocument();
    expect(screen.queryByText("账号与行为规范")).not.toBeInTheDocument();
    expect(screen.queryByText("内容规范")).not.toBeInTheDocument();
    expect(screen.queryByText("互动规范")).not.toBeInTheDocument();
    expect(screen.queryByText("违规处理")).not.toBeInTheDocument();
    expect(screen.queryByText("附则")).not.toBeInTheDocument();
    expect(screen.queryByText("提交举报")).not.toBeInTheDocument();
    expect(screen.queryByText("提交申诉")).not.toBeInTheDocument();
  });

  it("shows unavailable when community-rules cannot be loaded", async () => {
    mocked.getCommunityRules.mockRejectedValue(unavailable());
    renderRules();
    expect(await screen.findByText("社区规则暂不可用")).toBeInTheDocument();
  });
});

