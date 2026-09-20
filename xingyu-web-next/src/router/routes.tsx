import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { HomePage } from "@/features/home/pages/HomePage";
import { ArticleDetailPage } from "@/features/article/pages/ArticleDetailPage";
import { UserProfilePage } from "@/features/profile/pages/UserProfilePage";
import { StudioPage } from "@/features/studio/pages/StudioPage";
import { NotFound } from "@/components/shared/NotFound";
import { RequireAuth } from "./guards";
import { LEGACY_REDIRECTS, LegacyRedirectRoute } from "./redirects";

/**
 * The single routing table for Web V2 (Phase 0).
 * Routes: / , /login , /articles/:articleId , /u/:username , /studio , * (404)
 * plus the five approved Legacy redirects.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
        <Route path="/u/:username" element={<UserProfilePage />} />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <StudioPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {LEGACY_REDIRECTS.map((redirect) => (
        <Route
          key={redirect.from}
          path={redirect.from}
          element={<LegacyRedirectRoute to={redirect.to} />}
        />
      ))}
    </Routes>
  );
}
