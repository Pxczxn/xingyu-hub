import { MessageSquare } from "lucide-react";

type ReviewFeedbackCardProps = {
  message: string;
};

export function ReviewFeedbackCard({ message }: ReviewFeedbackCardProps) {
  return (
    <section className="xy-review-feedback" aria-label="审核反馈">
      <p>
        <MessageSquare aria-hidden="true" />
        <span>{message}</span>
      </p>
    </section>
  );
}
