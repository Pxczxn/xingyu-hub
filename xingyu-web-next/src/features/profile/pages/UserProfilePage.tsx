import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageState } from "@/components/shared/PageState";
import { validateUsernameClient } from "@/lib/username-rules";

/**
 * User profile — route host only (Phase 0).
 * Resolves the :username param; no profile API is wired yet.
 */
export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();

  if (!username) {
    return <PageState kind="empty" />;
  }

  const invalid = validateUsernameClient(username) !== null;

  return (
    <div className="section-gap">
      <Card>
        <CardHeader>
          <CardTitle>个人主页</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            用户名：<span className="font-mono text-foreground">{username}</span>
          </p>
          {invalid ? (
            <p className="text-sm text-destructive">用户名格式不符合规范。</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              资料尚未接入 — Phase 0 仅建立路由宿主。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
