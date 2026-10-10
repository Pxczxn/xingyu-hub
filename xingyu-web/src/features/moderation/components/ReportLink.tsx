import { Link } from "react-router-dom";
import { Flag } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";

/*
 * A lightweight "举报" entry, meant to sit in a content's secondary actions.
 *
 * Design constraints from the Governance Contract Recovery pass:
 *
 *  - Reporting is NOT a primary action. This is a small, muted text link — no
 *    accent button, no weight that competes with 点赞/评论. It is placed with
 *    the other low-emphasis actions, not in a hero or a floating CTA.
 *  - It only carries structured target context (`?objectType=&objectId=`) to the
 *    existing report route. The route asks the server what that target is; this
 *    link never claims a title or author.
 *  - Guests get no link: reporting requires an account (the write endpoint is
 *    authed), so offering it would lead straight to a 401.
 *  - `hidden` lets a page suppress the link when it knows the visitor is the
 *    author (you cannot report your own content). That is a courtesy only — the
 *    server is the one that actually enforces it.
 */
export function ReportLink({
  objectType,
  objectId,
  hidden = false,
  className,
}: {
  objectType: "ARTICLE" | "MOMENT" | "COMMENT";
  objectId: string;
  hidden?: boolean;
  className?: string;
}) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated || hidden || !objectId) return null;

  const href = `/reports/new?objectType=${encodeURIComponent(objectType)}&objectId=${encodeURIComponent(
    objectId,
  )}`;

  return (
    <Link
      to={href}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent",
        className,
      )}
      // The accessible name is stable regardless of the visible label's size.
      aria-label="举报这条内容"
    >
      <Flag className="h-3 w-3" aria-hidden />
      举报
    </Link>
  );
}
