import styles from "./review-detail.module.css";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

type ReviewFeedbackCardProps = {
  message: string;
};

export function ReviewFeedbackCard({ message }: ReviewFeedbackCardProps) {
  return (
    <section className={cn(styles.feedback)} aria-label="审核反馈">
      <p>
        <MessageSquare aria-hidden="true" />
        <span>{message}</span>
      </p>
    </section>
  );
}
