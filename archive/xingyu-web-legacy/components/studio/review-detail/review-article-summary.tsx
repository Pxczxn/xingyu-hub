import styles from "./review-detail.module.css";
import { cn } from "@/lib/utils";
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
    <section className={cn(styles.articleSection)} aria-label="稿件信息">
      <h3 className={cn(styles.articleLabel)}>稿件信息</h3>
      <article className={cn(styles.article)}>
        {coverSrc ? (
          <img src={coverSrc} alt="" className={cn(styles.articleCover)} />
        ) : (
          <div className={cn(styles.articleCover, styles.isPlaceholder)} aria-hidden="true">
            <FileText />
          </div>
        )}
        <div className={cn(styles.articleMeta)}>
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
