import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { PageState } from "@/components/shared/PageState";

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    announcementsApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">公告中心</h1>
        <Link to="/guide" className="text-sm text-accent hover:underline">
          使用指南
        </Link>
      </header>

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无已发布公告"
          description="有新的已发布公告时会出现在这里。"
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/announcements/${encodeURIComponent(item.id)}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
              >
                {/* 层级：标题 → 正文预览 → 时间。预览只帮读者在标题之外判断要不要点开，
                    不是把每条公告做成文章卡片，所以纯文本、最多两行、无富文本。 */}
                <h2 className="section-heading">{item.title}</h2>
                {announcementPreview(item.body) ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-foreground-soft">
                    {announcementPreview(item.body)}
                  </p>
                ) : null}
                {item.publishedAt ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatPublishedAt(item.publishedAt)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/*
 * 列表预览用的正文摘要。
 *
 * 直接用公开 DTO 已有的 `body`，**不新增 summary 字段**。
 * 公告正文是纯文本（`whitespace-pre-wrap` 渲染，HTML 不解析），这里把它压成一行：
 * 换行/制表/连续空白折成单空格，避免预览里出现空洞；最多 2 行由 CSS `line-clamp` 负责，
 * 这里不按字符数硬截断（免得多语言下算错），只是把结构压平。
 *
 * 没有 body 时返回空串 —— 列表会整行不渲染预览，而不是留个空段落。
 */
function announcementPreview(body?: string): string {
  if (!body) return "";
  return body.replace(/\s+/g, " ").trim();
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
