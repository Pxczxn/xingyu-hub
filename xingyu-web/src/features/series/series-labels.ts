import type { SeriesStatus } from "@/api/series/series.types";
import { ApiError } from "@/api/client";

export function seriesStatusLabel(status: SeriesStatus): string {
  return status === "ARCHIVED" ? "已归档" : "进行中";
}

export function apiErrorDetail(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.problem.status === 404 || error.problem.code === "NOT_FOUND")
  );
}

export function isConflictError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.problem.status === 409 && error.problem.code === "CONFLICT"
  );
}

export function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function articleDisplayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : "无标题文章";
}
