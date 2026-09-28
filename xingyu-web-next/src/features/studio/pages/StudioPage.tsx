import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth.store";

/**
 * Creation studio — workbench skeleton (Phase 0).
 * Access is protected by the RequireAuth guard in the router, so this page is
 * only rendered for authenticated users. No article editor is migrated yet.
 */
export function StudioPage() {
  const { user } = useAuth();

  return (
    <div className="section-gap">
      <Card>
        <CardHeader>
          <CardTitle>创作中心</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {user?.username ? `${user.username}，欢迎回来。` : "欢迎回来。"}
          </p>
          <p className="text-sm text-muted-foreground">
            工作台占位 — 草稿、已发布与审核状态将在后续阶段接入。
          </p>
          <Link to="/studio/series" className="text-sm text-accent hover:underline">
            我的系列
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <Link to="/studio/analytics" className="text-accent hover:underline">
              数据分析
            </Link>
            <p className="mt-1">查看已发布文章、喜欢、评论与粉丝等汇总数据。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {/* Still a placeholder on purpose: /studio/content has no LIST route
                (only /studio/content/:articleId exists), so there is nowhere
                honest to send the user yet. A link here would 404. */}
            已发布占位
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {/* Phase 2K-2: this cell used to read "审核中占位". /studio/submissions
                now exists, so it becomes a real entry point. */}
            <Link to="/studio/submissions" className="text-accent hover:underline">
              我的投稿
            </Link>
            <p className="mt-1">查看提交审核的稿件及进展。</p>
          </CardContent>
        </Card>
      </div>

      <Link to="/" className="text-sm text-accent hover:underline">
        返回首页
      </Link>
    </div>
  );
}
