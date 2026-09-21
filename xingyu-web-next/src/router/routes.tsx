import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { PendingAuditPage } from "@/features/auth/pages/PendingAuditPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { ForceChangePasswordPage } from "@/features/auth/pages/ForceChangePasswordPage";
import { HomePage } from "@/features/home/pages/HomePage";
import { DiscoverPage } from "@/features/discover/pages/DiscoverPage";
import { SearchPage } from "@/features/discover/pages/SearchPage";
import { TopicsPage } from "@/features/topics/pages/TopicsPage";
import { TopicDetailPage } from "@/features/topics/pages/TopicDetailPage";
import { ArticleDetailPage } from "@/features/article/pages/ArticleDetailPage";
import { UserProfilePage } from "@/features/profile/pages/UserProfilePage";
import { MeRedirectPage } from "@/features/profile/pages/MeRedirectPage";
import { StudioPage } from "@/features/studio/pages/StudioPage";
import { NotFound } from "@/components/shared/NotFound";
import { RequireAuth } from "./guards";
import { LEGACY_REDIRECTS, LegacyRedirectRoute } from "./redirects";

/**
 * The single routing table for Web V2 (Phase 1A).
 *
 * Content consumption: / , /discover , /search , /topics , /topics/:slug
 * Auth:                /login , /register , /register/pending-audit ,
 *                      /verify-email , /forgot-password , /reset-password ,
 *                      /force-change-password
 * Phase 0 hosts kept as-is: /articles/:articleId , /u/:username , /studio
 * plus the five approved Legacy redirects.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/topics/:slug" element={<TopicDetailPage />} />

        {/* Phase 1B: real article + public profile */}
        <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
        <Route path="/u/:username" element={<UserProfilePage />} />
        {/* /me is only an entry point to the current user's own profile. */}
        <Route path="/me" element={<MeRedirectPage />} />
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/pending-audit" element={<PendingAuditPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/force-change-password" element={<ForceChangePasswordPage />} />
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
