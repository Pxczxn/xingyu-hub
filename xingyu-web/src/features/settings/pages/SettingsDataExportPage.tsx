import { useState } from "react";
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

  return (
    <div className="section-gap">
      <section aria-labelledby="export-heading">
        <h2 id="export-heading" className="text-base font-semibold text-primary">
          导出我的数据
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          导出账号下可自助获取的数据（资料、文章、收藏夹、评论、点赞、书架、阅读历史）。
        </p>
      </section>

      <p className="text-sm text-muted-foreground" data-testid="export-limit-note">
        其中收藏夹、评论、点赞、书架与阅读历史每项最多导出 200 条。
      </p>

      {error ? (
        <p role="alert" data-testid="export-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {phase === "idle" || phase === "loading" ? (
        <div>
          <Button onClick={() => void load()} disabled={phase === "loading"} data-testid="export-load">
            {phase === "loading" ? "正在准备…" : "准备导出"}
          </Button>
        </div>
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
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="export-sections">
            {sections.map((section) => (
              <li
                key={section.key}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="text-foreground">{section.label}</span>
                <span className="text-xs text-muted-foreground">
                  {section.count === null ? "—" : `${section.count} 条`}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button onClick={download} data-testid="export-download">
              下载 JSON 文件
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

