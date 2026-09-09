import { FileText } from "lucide-react";
import { resolveMediaUrl } from "@/lib/api-client";

type ReviewArticleSummaryProps = {
  title: string;
  articleId: string;
  submittedAt: string;
  coverUrl?: string | null;
};

function shortenArticleId(articleId: string): string {
  if (articleId.length <= 12) return articleId;
  return `${articleId.slice(0, 8)}…`;
}

export function ReviewArticleSummary({
  title,
  articleId,
  submittedAt,
  coverUrl,
}: ReviewArticleSummaryProps) {
  const coverSrc = coverUrl ? resolveMediaUrl(coverUrl) : null;

  return (
    <section className="xy-review-article-section" aria-label="稿件信息">
      <h3 className="xy-review-article-label">稿件信息</h3>
      <article className="xy-review-article">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="xy-review-article-cover" />
        ) : (
          <div className="xy-review-article-cover is-placeholder" aria-hidden="true">
            <FileText />
          </div>
        )}
        <div className="xy-review-article-meta">
          <h2>{title}</h2>
          <dl>
            <div>
              <dt>发布时间</dt>
              <dd>{submittedAt}</dd>
            </div>
            <div>
              <dt>文章 ID</dt>
              <dd title={articleId}>{shortenArticleId(articleId)}</dd>
            </div>
          </dl>
        </div>
      </article>
    </section>
  );
}
