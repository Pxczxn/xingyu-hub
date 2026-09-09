import { Check, XCircle } from "lucide-react";
import type { ReviewStatusMeta } from "./review-detail-meta";

type ReviewStatusHeaderProps = {
  meta: ReviewStatusMeta;
};

export function ReviewStatusHeader({ meta }: ReviewStatusHeaderProps) {
  const showIcon = meta.tone !== "pending";

  return (
    <header className={`xy-review-result is-${meta.tone}`}>
      <div>
        {showIcon ? <i aria-hidden="true">{resolveStatusIcon(meta.tone)}</i> : null}
        <span>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </span>
      </div>
    </header>
  );
}

function resolveStatusIcon(tone: ReviewStatusMeta["tone"]) {
  switch (tone) {
    case "approved":
      return <Check />;
    case "rejected":
    case "returned":
      return <XCircle />;
    default:
      return null;
  }
}
