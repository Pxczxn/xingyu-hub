import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth.store";

/**
 * Creation studio — entry hub.
 * Access is protected by the RequireAuth guard in the router, so this page is
 * only rendered for authenticated users.
 *
 * Phase 3G removed the last placeholder here. The article editor was shipped in
 * Phase 1C, but nothing linked to it — this hub pointed at a dead "已发布占位"
 * string because `/studio/content` (the list route) did not exist. That route
 * now exists, so the hub offers real entries: 新建文章 / 我的内容 / 我的系列.
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
          <p className="text-sm text-muted-foreground">在这里管理你的文章、系列与投稿。</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Link to="/studio/content/new" className="text-sm text-accent hover:underline">
              新建文章
            </Link>
            <Link to="/studio/content" className="text-sm text-accent hover:underline">
              我的内容
            </Link>
            <Link to="/studio/series" className="text-sm text-accent hover:underline">
              我的系列
            </Link>
          </div>
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
            {/* Phase 3G: was a dead "已发布占位" string because /studio/content had
                no LIST route. That route now exists, so this card links to it.
                The trash lives inside the content page as a tab — the owner list
                endpoint and GET /me/trash are separate, so it is not a filter. */}
            <Link to="/studio/content" className="text-accent hover:underline">
              内容管理
            </Link>
            <p className="mt-1">按状态查看全部文章，也可以移入回收站或恢复。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <Link to="/studio/submissions" className="text-accent hover:underline">
              我的投稿
            </Link>
            <p className="mt-1">查看提交审核的稿件及进展。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {/* Phase 2M. Note the copy does NOT promise a collaborator list — the
                backend has no such concept, so the entry point only creates and
                confirms invite links. */}
            <Link to="/studio/collaboration" className="text-accent hover:underline">
              邀请协作
            </Link>
            <p className="mt-1">生成邀请链接，发给想一起创作的人。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {/* Phase 2N. This page did not exist in Legacy at all — the backend
                CRUD was never surfaced. */}
            <Link to="/studio/categories" className="text-accent hover:underline">
              创作空间分类
            </Link>
            <p className="mt-1">给作品分组，方便在主页按分类浏览。</p>
          </CardContent>
        </Card>
      </div>

      <Link to="/" className="text-sm text-accent hover:underline">
        返回首页
      </Link>
    </div>
  );
}
