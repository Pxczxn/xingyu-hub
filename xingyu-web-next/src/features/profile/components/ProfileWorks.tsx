import { Link } from "react-router-dom";
import type { SpaceWorks } from "@/api/users/users.types";
import { Card, CardContent } from "@/components/ui/card";

/*
 * Public works list for a profile.
 * Real endpoint: GET /api/v1/users/{username}/works -> { works: [{id,title,...}] }.
 */
export function ProfileWorks({ works }: { works: SpaceWorks }) {
  if (works.works.length === 0) {
    return (
      <p data-testid="works-empty" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        还没有公开作品。
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="works-list">
      {works.works.map((work) => (
        <li key={work.id}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-2 p-5">
              <Link
                to={`/articles/${work.id}`}
                className="line-clamp-2 text-sm font-semibold text-foreground hover:text-accent"
              >
                {work.title}
              </Link>
              {work.summary ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{work.summary}</p>
              ) : null}
              {work.categorySlug ? (
                <span className="mt-auto text-xs text-muted-foreground">{work.categorySlug}</span>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
