import Link from "next/link";
import { ChevronRight } from "lucide-react";

const REVIEW_KEYWORDS = ["内容价值", "原创性", "表达规范", "社区友善"] as const;

export function ReviewStandardsPanel() {
  return (
    <section className="xy-review-standards">
      <details className="xy-review-standards-details">
        <summary>
          <span>审核标准参考</span>
          <ChevronRight aria-hidden="true" />
        </summary>
        <div className="xy-review-standards-body">
          <p className="xy-review-standards-tags">
            {REVIEW_KEYWORDS.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </p>
          <p className="xy-review-standards-copy">
            审核会关注内容是否有实际价值、是否原创、表达是否清晰，以及是否符合社区友善规范。发布前建议自行检查标题、封面与引用来源。
          </p>
          <Link href="/guide">
            查看完整标准 <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </details>
    </section>
  );
}
