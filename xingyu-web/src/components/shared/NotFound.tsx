import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 404 fallback for the catch-all route. */
export function NotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>页面不存在</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          你访问的页面尚未迁移到 Web V2，或者地址有误。
        </p>
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          返回首页
        </Link>
      </CardContent>
    </Card>
  );
}
