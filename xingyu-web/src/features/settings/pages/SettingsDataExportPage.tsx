import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import { accountApi } from "@/api/account/account.api";
import { ApiError } from "@/api/client";
import type { DataExportPayload } from "@/api/account/account.types";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { dataExportFilename, exportSections } from "@/features/settings/account-security";

/*
 * /settings/data/export (Phase 3H).
 *
 * `GET /api/v1/me/data-export` returns a JSON snapshot assembled by
 * DataExportService: profile / articles / collections / comments / likes /
 * bookshelf / readingHistory, each capped at 200 rows.
 *
 * ⚠️ There is NO server-side file or zip endpoint, and no async "job id" to poll
 * — the JSON body IS the export. So the download is done entirely client-side
 * from the fetched payload. Offering a "导出任务" progress UI would be fiction.
 *
 * ⚠️ The per-section counts are a PREVIEW, not a promise of completeness:
 * collections/comments/likes/bookshelf/readingHistory are capped at 200, so a
 * user with more rows gets a truncated section. The copy says so.
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * The old skeleton was the settings default again: 标题 → 说明段落 → 一个按钮 →
 * 一个两列清单. But this is the only settings page whose subject is NUMBERS —
 * "how much of my data is there" is the question, and the answer is seven counts.
 * Numbers rendered as 13px grey text inside 32px rows answer that question in the
 * least legible possible way.
 *
 * It is now a two-state page with no form at all:
 *
 *   idle    -> one PREPARATION PANEL: what will be exported, and one action
 *   ready   -> a COUNT GRID (the counts ARE the content, set large) over an
 *              ACTION BAR that carries the single download
 *
 * The three states never coexist, so the page never shows a disabled button next
 * to a list that does not exist yet.
 * ---------------------------------------------------------------------------
 */

type Phase = "idle" | "loading" | "error" | "ready";

export function SettingsDataExportPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [payload, setPayload] = useState<DataExportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setPhase("loading");
    setError(null);
    try {
      const data = await accountApi.getDataExport();
      setPayload(data);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.detail : "导出失败，请稍后重试。");
      setPhase("error");
    }
  }

  function download() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = dataExportFilename(new Date());
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const sections = payload ? exportSections(payload) : [];
  const total = sections.reduce((sum, section) => sum + (section.count ?? 0), 0);

  return (
    <div className="section-gap">
      <section aria-labelledby="export-heading">
        <h2 id="export-heading" className="section-heading">
          导出我的数据
        </h2>
        <p className="lede mt-1.5 max-w-2xl">
          导出账号下可自助获取的数据（资料、文章、收藏夹、评论、点赞、书架、阅读历史）。
        </p>
      </section>

      {phase === "idle" || phase === "loading" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"
              aria-hidden
            >
              <FileJson className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-card font-medium text-primary">生成一份 JSON 快照</p>
              <p className="mt-0.5 text-meta text-muted-foreground" data-testid="export-limit-note">
                其中收藏夹、评论、点赞、书架与阅读历史每项最多导出 200 条。
              </p>
            </div>
          </div>
          <Button
            onClick={() => void load()}
            disabled={phase === "loading"}
            data-testid="export-load"
            className="shrink-0"
          >
            {phase === "loading" ? "正在准备…" : "准备导出"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          data-testid="export-error"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
        >
          {error}
        </p>
      ) : null}

      {phase === "error" ? (
        <div className="section-gap">
          <PageState kind="error" title="导出失败" description="请稍后重试。" />
          <div>
            <Button variant="outline" onClick={() => void load()} data-testid="export-retry">
              重新加载
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "ready" && payload ? (
        <>
          <ul
            className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="export-sections"
          >
            {sections.map((section) => (
              <li
                key={section.key}
                className="flex flex-col gap-1 rounded-xl border border-border/70 bg-card p-4"
              >
                <span className="text-meta text-muted-foreground">{section.label}</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">
                  {section.count === null ? "—" : `${section.count} 条`}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-sunken/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-meta text-muted-foreground">
              快照共 <span className="font-medium tabular-nums text-foreground">{total}</span>{" "}
              条记录。 下载后可用任意文本编辑器打开。
            </p>
            <Button onClick={download} data-testid="export-download" className="shrink-0">
              <Download className="h-4 w-4" aria-hidden />
              下载 JSON 文件
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
