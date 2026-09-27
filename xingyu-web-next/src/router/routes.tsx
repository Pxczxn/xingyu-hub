import { lazy, Suspense, type ReactNode } from "react";
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
import { UserProfilePage } from "@/features/profile/pages/UserProfilePage";
import { MeRedirectPage } from "@/features/profile/pages/MeRedirectPage";
import { SettingsLayout } from "@/features/settings/pages/SettingsLayout";
import { SettingsProfilePage } from "@/features/settings/pages/SettingsProfilePage";
import { SettingsPrivacyPage } from "@/features/settings/pages/SettingsPrivacyPage";
import { SettingsSessionsPage } from "@/features/settings/pages/SettingsSessionsPage";
import { SettingsBlocksPage } from "@/features/settings/pages/SettingsBlocksPage";
import { SettingsApiTokensPage } from "@/features/settings/pages/SettingsApiTokensPage";
import { OnboardingAliasRedirect, OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { AnnouncementsPage } from "@/features/announcements/pages/AnnouncementsPage";
import { AnnouncementDetailPage } from "@/features/announcements/pages/AnnouncementDetailPage";
import { GuideIndexPage } from "@/features/guide/pages/GuideIndexPage";
import { GuideDetailPage } from "@/features/guide/pages/GuideDetailPage";
import { RulesPage } from "@/features/rules/pages/RulesPage";
import { CollectionsPage } from "@/features/collections/pages/CollectionsPage";
import { CollectionManagePage } from "@/features/collections/pages/CollectionManagePage";
import { CollectionPublicPage } from "@/features/collections/pages/CollectionPublicPage";
import { BookshelfPage } from "@/features/bookshelf/pages/BookshelfPage";
import { MomentsPage } from "@/features/moments/pages/MomentsPage";
import { MomentDetailPage } from "@/features/moments/pages/MomentDetailPage";
import { StudioPage } from "@/features/studio/pages/StudioPage";
import { SeriesListPage } from "@/features/series/pages/SeriesListPage";
import { SeriesNewPage } from "@/features/series/pages/SeriesNewPage";
import { SeriesEditPage } from "@/features/series/pages/SeriesEditPage";
import { SeriesArticlesPage } from "@/features/series/pages/SeriesArticlesPage";
import { PublicSeriesListPage } from "@/features/series/pages/PublicSeriesListPage";
import { PublicSeriesDetailPage } from "@/features/series/pages/PublicSeriesDetailPage";
import { PublicSeriesReadPage } from "@/features/series/pages/PublicSeriesReadPage";
import { NotFound } from "@/components/shared/NotFound";
import { PageState } from "@/components/shared/PageState";
import { RequireAuth } from "./guards";
import { LEGACY_REDIRECTS, LegacyRedirectRoute } from "./redirects";

/**
 * The single routing table for Web V2 (Phase 1A, extended in 1B / 1C-1).
 *
 * Content consumption: / , /discover , /search , /topics , /topics/:slug
 * Auth:                /login , /register , /register/pending-audit ,
 *                      /verify-email , /forgot-password , /reset-password ,
 *                      /force-change-password
 * Phase 0 hosts kept as-is: /articles/:articleId , /u/:username , /studio
 * Phase 1C-1:          /studio/content/:articleId  (articleId === "new" = blank doc)
 * Phase 2A-1:          /settings/profile , /settings/privacy , /settings/sessions
 *                      (shared SettingsLayout; `/settings` stays a Legacy redirect)
 * Phase 2A-2a:         /settings/blocks (same shell) + the block entry on /u/:username
 * Phase 2A-2b:         /settings/api-tokens (same shell)
 * Phase 2A-3:          /onboarding (aliases /welcome /interests /follows /profile)
 * Phase 2B:            /announcements, /announcements/:id, /guide, /guide/:slug, /rules
 *                      (public, read-only, no RequireAuth)
 * Phase 2C:            /me/collections, /me/collections/:id, /me/bookshelf (RequireAuth)
 *                      /collections/:id (public, read-only)
 * Phase 2F:            /studio/series, /studio/series/new, /studio/series/:id/edit,
 *                      /studio/series/:id/articles (creator Series)
 * Phase 2G:            /series, /series/:seriesId, /series/:seriesId/read
 *                      (public Series square + detail + reader; guest-readable)
 * Phase 2D:            /moments, /moments/:id (public feed/detail; publish CTA login-gated)
 * plus the five approved Legacy redirects.
 *
 * Route-level code splitting (Phase 1C-1):
 *   /articles/:articleId and /studio/content/:articleId are the only two hosts of
 *   the heavy Markdown/editor stacks (remark+rehype+unified on the read side,
 *   Milkdown/Crepe on the edit side). They are `lazy()` so neither pipeline sits
 *   in the entry chunk. Behaviour of both pages is untouched — only the import
 *   site changed.
 */

const ArticleDetailPage = lazy(() =>
  import("@/features/article/pages/ArticleDetailPage").then((module) => ({
    default: module.ArticleDetailPage,
  })),
);

const EditorPage = lazy(() =>
  import("@/features/studio/pages/EditorPage").then((module) => ({
    default: module.EditorPage,
  })),
);

/** Keeps the app shell (nav/footer) mounted while a lazy route chunk downloads. */
function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageState kind="loading" />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/topics/:slug" element={<TopicDetailPage />} />

        {/* Phase 2B: public static info. Guest-reachable, no login gate. */}
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
        <Route path="/rules" element={<RulesPage />} />

        {/* Phase 2C: public collection detail. 404 hides PRIVATE/UNLISTED. */}
        <Route path="/collections/:id" element={<CollectionPublicPage />} />

        {/* Phase 2D: public moments. The whole feed is guest-readable;
            only the publish CTA sends guests to login. No /me/moments page,
            no /moments/new, no /moments/:id/edit. */}
        <Route path="/moments" element={<MomentsPage />} />
        <Route path="/moments/:id" element={<MomentDetailPage />} />

        {/* Phase 2G: public series. Guest-readable square + detail; the reader
            needs no session either. Subscribing is the only signed-in action.
            `/series/:id/read` must be declared after `/series` and `/series/:id`
            is unnecessary here — react-router 7 ranks static "read" higher. */}
        <Route path="/series" element={<PublicSeriesListPage />} />
        <Route path="/series/:seriesId" element={<PublicSeriesDetailPage />} />
        <Route path="/series/:seriesId/read" element={<PublicSeriesReadPage />} />

        {/* Phase 1B: real article + public profile */}
        <Route
          path="/articles/:articleId"
          element={
            <LazyRoute>
              <ArticleDetailPage />
            </LazyRoute>
          }
        />
        <Route path="/u/:username" element={<UserProfilePage />} />
        {/* /me is only an entry point to the current user's own profile. */}
        <Route path="/me" element={<MeRedirectPage />} />
        <Route
          path="/me/collections"
          element={
            <RequireAuth>
              <CollectionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/collections/:id"
          element={
            <RequireAuth>
              <CollectionManagePage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/bookshelf"
          element={
            <RequireAuth>
              <BookshelfPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <StudioPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/series"
          element={
            <RequireAuth>
              <SeriesListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/series/new"
          element={
            <RequireAuth>
              <SeriesNewPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/series/:id/edit"
          element={
            <RequireAuth>
              <SeriesEditPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/series/:id/articles"
          element={
            <RequireAuth>
              <SeriesArticlesPage />
            </RequireAuth>
          }
        />

        {/* Phase 2A-3: onboarding. Subpaths are aliases so Legacy bookmarks
            land on the same step machine (the server `step` field). */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route path="/onboarding/welcome" element={<OnboardingAliasRedirect />} />
        <Route path="/onboarding/interests" element={<OnboardingAliasRedirect />} />
        <Route path="/onboarding/follows" element={<OnboardingAliasRedirect />} />
        <Route path="/onboarding/profile" element={<OnboardingAliasRedirect />} />

        {/* Phase 2A-1: Settings.
            The layout route is PATHLESS on purpose: `/settings` itself stays a
            Legacy redirect (see redirects.tsx), and a pathless parent cannot
            collide with it while still giving all three pages the shared shell. */}
        <Route
          element={
            <RequireAuth>
              <SettingsLayout />
            </RequireAuth>
          }
        >
          <Route path="/settings/profile" element={<SettingsProfilePage />} />
          <Route path="/settings/privacy" element={<SettingsPrivacyPage />} />
          <Route path="/settings/sessions" element={<SettingsSessionsPage />} />
          <Route path="/settings/blocks" element={<SettingsBlocksPage />} />
          <Route path="/settings/api-tokens" element={<SettingsApiTokensPage />} />
        </Route>

        {/* Phase 1C-1: editor. One route covers both "existing draft" and
            "new article" (Legacy used the same magic `new` id). */}
        <Route
          path="/studio/content/:articleId"
          element={
            <RequireAuth>
              <LazyRoute>
                <EditorPage />
              </LazyRoute>
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
