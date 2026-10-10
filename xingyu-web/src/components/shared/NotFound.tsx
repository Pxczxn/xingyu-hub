import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { LostOrbit } from "./illustrations";

/*
 * 404 fallback for the catch-all route.
 *
 * 2026-10-03 (illustration pass):
 *
 *   - It was a three-line card pinned to the TOP of a full-height column, which left
 *     ~370px of bare cream underneath. That does not read as generous whitespace, it
 *     reads as a page that failed to finish loading. The block is now centred, which
 *     is the actual fix; the artwork is what gives the centred block something to be
 *     centred around.
 *   - Centring uses `min-h-[70vh]` rather than `min-h-full`: `main` is a flex ITEM,
 *     not a flex container, so a percentage min-height against it does not resolve
 *     (measured: the card stayed at the top). The alternative — making `main` a
 *     flex column so children can use `flex-1` — would stop margins collapsing on
 *     every one of the 91 routes to fix one page.
 *   - `LostOrbit` is the one illustration in the app that is a 404 and nothing else:
 *     a body that has left its path, drawn with the path broken where it went.
 *   - The heading is an `h1` now. It was a `CardTitle` (an `h3`), so the page had no
 *     top-level heading at all.
 */
export function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <LostOrbit className="h-28 w-auto sm:h-32" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-primary">页面不存在</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              你访问的页面尚未迁移到 Web V2，或者地址有误。
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            返回首页
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
