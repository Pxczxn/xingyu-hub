import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageState } from "@/components/shared/PageState";

/**
 * Article detail — route host only (Phase 0).
 * No article API, no Markdown/editor rendering yet; the page resolves the
 * :articleId param and exposes loading / error / empty states for later wiring.
 */
export function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();

  if (!articleId) {
    return <PageState kind="empty" />;
  }

  return (
    <div className="section-gap">
      <Card>
        <CardHeader>
          <CardTitle>文章详情</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            文章 ID：<span className="font-mono text-foreground">{articleId}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            正文尚未接入 — Phase 0 仅建立路由宿主与状态位。
          </p>
        </CardContent>
      </Card>

      {/* State placeholders for the future article request lifecycle. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <PageState kind="loading" />
        <PageState kind="error" />
        <PageState kind="empty" />
      </div>
    </div>
  );
}
