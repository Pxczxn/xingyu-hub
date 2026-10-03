import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { HomePage } from "@/features/home/pages/HomePage";
import { NotFound } from "@/components/shared/NotFound";
import { RequireAuth } from "./guards";
import { LEGACY_REDIRECTS, LegacyRedirectRoute } from "./redirects";

/*
 * P1-1: the two heaviest hosts, split in Phase 1C-1 and kept explicit here.
 *   /articles/:articleId      -> remark + rehype + unified (read pipeline)
 *   /studio/content/:articleId -> Milkdown/Crepe + CodeMirror (edit pipeline)
 * Neither pipeline may sit in the entry chunk; the marker scan in the phase
 * report pins that (micromark / remark / rehype / unified / mdast / turndown /
 * milkdown / crepe / prosemirror / CodeMirror must all be 0 hits in index-*.js).
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
 * Phase 2H:            /galaxies, /galaxies/:slug, /galaxies/:slug/members,
 *                      /galaxies/:slug/content (public square + detail + roster +
 *                      feed; guest-readable. Keyed by SLUG — the backend has no
 *                      /galaxies/{id} route. Joining is the only signed-in action.)
 * Phase 2I-1:          /me/following, /me/followers (RequireAuth; follow graph)
 * Phase 2I-2:          /notifications (RequireAuth; notification centre. A NEW
 *                      page — Legacy left /notifications as a redirect to `/`
 *                      and only rendered notifications in a header popover, so
 *                      there is no Legacy route to port. Deliberately NOT added
 *                      to LEGACY_REDIRECTS: that set is pinned at five.)
 * Phase 2I-3:          /messages, /messages/:conversationId (RequireAuth)
 * Phase 2I-3b:         /messages/search (mailbox-wide; a static segment that
 *                      outranks :conversationId), /messages/:conversationId/media,
 *                      /messages/:conversationId/files (RequireAuth)
 * Phase 2I-4:          /events, /events/:eventId (public; guest-readable square +
 *                      detail), /events/:eventId/submit, /me/events (RequireAuth;
 *                      submission and the personal record both write under /me/*)
 * Phase 2I-5:          /me/moments (RequireAuth; the owner's own moment history —
 *                      distinct from the public feed at /moments, which stays the
 *                      place publishing happens)
 * Phase 2J-1:          /me/likes, /me/comments (RequireAuth; the rest of 我的互动.
 *                      `/me/history` is NOT shipped — no backend route exists)
 * Phase 2J-2:          /reports, /reports/new, /reports/:reportId, /appeals,
 *                      /appeals/new, /appeals/:appealId (all RequireAuth; 举报与申诉.
 *                      Routes at the resource root to match the write endpoints)
 * Phase 2L:            /studio/analytics, /studio/content/:articleId/versions
 * Phase 2M:            /studio/collaboration, /studio/collaboration/accept
 *                      (RequireAuth; invite link create + confirm. NOTE: the
 *                      backend has NO collaboration relationship — accept writes
 *                      nothing. The UI discloses this rather than implying a
 *                      permission grant.)
 * Phase 2N:            /studio/categories (RequireAuth; creation-space category
 *                      CRUD. NOT a migration — the backend API existed and was
 *                      never surfaced by Legacy. Archive and delete are separate
 *                      operations and the UI keeps them separate.)
 * Phase 3I:            /messages/saved, /me/galaxies (RequireAuth). The last two
 *                      surfaced-but-unwired gaps: the /me/saved-messages bookmark
 *                      store and 「我加入的星系」 (`GET /me/galaxies`, which
 *                      GalaxyShell already called as a side channel). Both are
 *                      session-scoped; neither has a Legacy route to port.
 * plus the five approved Legacy redirects.
 *
 *
 * Route-level code splitting (P1-1, 2026-09-29):
 *   EVERY feature page is `lazy()`. The single Suspense boundary lives in the
 *   layouts (AppLayout / AuthLayout wrap their <Outlet />), so the app shell —
 *   nav, footer, header badges — stays mounted while a route chunk downloads.
 *   Only the shell, the guards, the shared primitives, the Legacy redirect table
 *   and the landing page (`/`, kept eager for LCP) remain in the entry chunk.
 *   Page files themselves are untouched: only the import sites changed.
 *
 *   Phase 1C-1 had split just the two heavy hosts (`/articles/:articleId` and
 *   `/studio/content/:articleId`); the remaining 90 routes still shipped inside
 *   the entry chunk, which is what this phase fixes.
 */

const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);

const RegisterPage = lazy(() =>
  import("@/features/auth/pages/RegisterPage").then((module) => ({ default: module.RegisterPage })),
);

const PendingAuditPage = lazy(() =>
  import("@/features/auth/pages/PendingAuditPage").then((module) => ({
    default: module.PendingAuditPage,
  })),
);

const VerifyEmailPage = lazy(() =>
  import("@/features/auth/pages/VerifyEmailPage").then((module) => ({
    default: module.VerifyEmailPage,
  })),
);

const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

const ResetPasswordPage = lazy(() =>
  import("@/features/auth/pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);

const ForceChangePasswordPage = lazy(() =>
  import("@/features/auth/pages/ForceChangePasswordPage").then((module) => ({
    default: module.ForceChangePasswordPage,
  })),
);

const DiscoverPage = lazy(() =>
  import("@/features/discover/pages/DiscoverPage").then((module) => ({
    default: module.DiscoverPage,
  })),
);

const SearchPage = lazy(() =>
  import("@/features/discover/pages/SearchPage").then((module) => ({ default: module.SearchPage })),
);

const TopicsPage = lazy(() =>
  import("@/features/topics/pages/TopicsPage").then((module) => ({ default: module.TopicsPage })),
);

const TopicDetailPage = lazy(() =>
  import("@/features/topics/pages/TopicDetailPage").then((module) => ({
    default: module.TopicDetailPage,
  })),
);

const CreatorsPage = lazy(() =>
  import("@/features/creators/pages/CreatorsPage").then((module) => ({
    default: module.CreatorsPage,
  })),
);

const UserProfilePage = lazy(() =>
  import("@/features/profile/pages/UserProfilePage").then((module) => ({
    default: module.UserProfilePage,
  })),
);

const MeRedirectPage = lazy(() =>
  import("@/features/profile/pages/MeRedirectPage").then((module) => ({
    default: module.MeRedirectPage,
  })),
);

const SettingsLayout = lazy(() =>
  import("@/features/settings/pages/SettingsLayout").then((module) => ({
    default: module.SettingsLayout,
  })),
);

const SettingsProfilePage = lazy(() =>
  import("@/features/settings/pages/SettingsProfilePage").then((module) => ({
    default: module.SettingsProfilePage,
  })),
);

const SettingsPrivacyPage = lazy(() =>
  import("@/features/settings/pages/SettingsPrivacyPage").then((module) => ({
    default: module.SettingsPrivacyPage,
  })),
);

const SettingsSessionsPage = lazy(() =>
  import("@/features/settings/pages/SettingsSessionsPage").then((module) => ({
    default: module.SettingsSessionsPage,
  })),
);

const SettingsBlocksPage = lazy(() =>
  import("@/features/settings/pages/SettingsBlocksPage").then((module) => ({
    default: module.SettingsBlocksPage,
  })),
);

const SettingsApiTokensPage = lazy(() =>
  import("@/features/settings/pages/SettingsApiTokensPage").then((module) => ({
    default: module.SettingsApiTokensPage,
  })),
);

const SettingsEmailPage = lazy(() =>
  import("@/features/settings/pages/SettingsEmailPage").then((module) => ({
    default: module.SettingsEmailPage,
  })),
);

const SettingsReauthenticatePage = lazy(() =>
  import("@/features/settings/pages/SettingsReauthenticatePage").then((module) => ({
    default: module.SettingsReauthenticatePage,
  })),
);

const SettingsDataExportPage = lazy(() =>
  import("@/features/settings/pages/SettingsDataExportPage").then((module) => ({
    default: module.SettingsDataExportPage,
  })),
);

const SettingsDeleteAccountPage = lazy(() =>
  import("@/features/settings/pages/SettingsDeleteAccountPage").then((module) => ({
    default: module.SettingsDeleteAccountPage,
  })),
);

const OnboardingAliasRedirect = lazy(() =>
  import("@/features/onboarding/pages/OnboardingPage").then((module) => ({
    default: module.OnboardingAliasRedirect,
  })),
);

const OnboardingPage = lazy(() =>
  import("@/features/onboarding/pages/OnboardingPage").then((module) => ({
    default: module.OnboardingPage,
  })),
);

const AnnouncementsPage = lazy(() =>
  import("@/features/announcements/pages/AnnouncementsPage").then((module) => ({
    default: module.AnnouncementsPage,
  })),
);

const AnnouncementDetailPage = lazy(() =>
  import("@/features/announcements/pages/AnnouncementDetailPage").then((module) => ({
    default: module.AnnouncementDetailPage,
  })),
);

const GuideIndexPage = lazy(() =>
  import("@/features/guide/pages/GuideIndexPage").then((module) => ({
    default: module.GuideIndexPage,
  })),
);

const GuideDetailPage = lazy(() =>
  import("@/features/guide/pages/GuideDetailPage").then((module) => ({
    default: module.GuideDetailPage,
  })),
);

const RulesPage = lazy(() =>
  import("@/features/rules/pages/RulesPage").then((module) => ({ default: module.RulesPage })),
);

const RecommendationFeedbackPage = lazy(() =>
  import("@/features/feedback/pages/RecommendationFeedbackPage").then((module) => ({
    default: module.RecommendationFeedbackPage,
  })),
);

const CollectionsPage = lazy(() =>
  import("@/features/collections/pages/CollectionsPage").then((module) => ({
    default: module.CollectionsPage,
  })),
);

const CollectionManagePage = lazy(() =>
  import("@/features/collections/pages/CollectionManagePage").then((module) => ({
    default: module.CollectionManagePage,
  })),
);

const CollectionPublicPage = lazy(() =>
  import("@/features/collections/pages/CollectionPublicPage").then((module) => ({
    default: module.CollectionPublicPage,
  })),
);

const BookshelfPage = lazy(() =>
  import("@/features/bookshelf/pages/BookshelfPage").then((module) => ({
    default: module.BookshelfPage,
  })),
);

const MomentsPage = lazy(() =>
  import("@/features/moments/pages/MomentsPage").then((module) => ({
    default: module.MomentsPage,
  })),
);

const MomentDetailPage = lazy(() =>
  import("@/features/moments/pages/MomentDetailPage").then((module) => ({
    default: module.MomentDetailPage,
  })),
);

const StudioPage = lazy(() =>
  import("@/features/studio/pages/StudioPage").then((module) => ({ default: module.StudioPage })),
);

const MySubmissionsPage = lazy(() =>
  import("@/features/studio/pages/MySubmissionsPage").then((module) => ({
    default: module.MySubmissionsPage,
  })),
);

const SubmissionDetailPage = lazy(() =>
  import("@/features/studio/pages/SubmissionDetailPage").then((module) => ({
    default: module.SubmissionDetailPage,
  })),
);

const ArticleVersionsPage = lazy(() =>
  import("@/features/studio/pages/ArticleVersionsPage").then((module) => ({
    default: module.ArticleVersionsPage,
  })),
);

const StudioAnalyticsPage = lazy(() =>
  import("@/features/studio/pages/StudioAnalyticsPage").then((module) => ({
    default: module.StudioAnalyticsPage,
  })),
);

const CollaborationInvitePage = lazy(() =>
  import("@/features/studio/pages/CollaborationInvitePage").then((module) => ({
    default: module.CollaborationInvitePage,
  })),
);

const CollaborationAcceptPage = lazy(() =>
  import("@/features/studio/pages/CollaborationAcceptPage").then((module) => ({
    default: module.CollaborationAcceptPage,
  })),
);

const StudioCategoriesPage = lazy(() =>
  import("@/features/studio/pages/StudioCategoriesPage").then((module) => ({
    default: module.StudioCategoriesPage,
  })),
);

const ContentListPage = lazy(() =>
  import("@/features/studio/pages/ContentListPage").then((module) => ({
    default: module.ContentListPage,
  })),
);

const SeriesListPage = lazy(() =>
  import("@/features/series/pages/SeriesListPage").then((module) => ({
    default: module.SeriesListPage,
  })),
);

const SeriesNewPage = lazy(() =>
  import("@/features/series/pages/SeriesNewPage").then((module) => ({
    default: module.SeriesNewPage,
  })),
);

const SeriesEditPage = lazy(() =>
  import("@/features/series/pages/SeriesEditPage").then((module) => ({
    default: module.SeriesEditPage,
  })),
);

const SeriesArticlesPage = lazy(() =>
  import("@/features/series/pages/SeriesArticlesPage").then((module) => ({
    default: module.SeriesArticlesPage,
  })),
);

const PublicSeriesListPage = lazy(() =>
  import("@/features/series/pages/PublicSeriesListPage").then((module) => ({
    default: module.PublicSeriesListPage,
  })),
);

const PublicSeriesDetailPage = lazy(() =>
  import("@/features/series/pages/PublicSeriesDetailPage").then((module) => ({
    default: module.PublicSeriesDetailPage,
  })),
);

const PublicSeriesReadPage = lazy(() =>
  import("@/features/series/pages/PublicSeriesReadPage").then((module) => ({
    default: module.PublicSeriesReadPage,
  })),
);

const GalaxyListPage = lazy(() =>
  import("@/features/galaxies/pages/GalaxyListPage").then((module) => ({
    default: module.GalaxyListPage,
  })),
);

const GalaxyDetailPage = lazy(() =>
  import("@/features/galaxies/pages/GalaxyDetailPage").then((module) => ({
    default: module.GalaxyDetailPage,
  })),
);

const GalaxyMembersPage = lazy(() =>
  import("@/features/galaxies/pages/GalaxyMembersPage").then((module) => ({
    default: module.GalaxyMembersPage,
  })),
);

const GalaxyContentPage = lazy(() =>
  import("@/features/galaxies/pages/GalaxyContentPage").then((module) => ({
    default: module.GalaxyContentPage,
  })),
);

const MyGalaxiesPage = lazy(() =>
  import("@/features/galaxies/pages/MyGalaxiesPage").then((module) => ({
    default: module.MyGalaxiesPage,
  })),
);

const MyFollowingPage = lazy(() =>
  import("@/features/social/pages/FollowListPage").then((module) => ({
    default: module.MyFollowingPage,
  })),
);

const MyFollowersPage = lazy(() =>
  import("@/features/social/pages/FollowListPage").then((module) => ({
    default: module.MyFollowersPage,
  })),
);

const NotificationsPage = lazy(() =>
  import("@/features/notifications/pages/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);

const MailboxPage = lazy(() =>
  import("@/features/messages/pages/MailboxPage").then((module) => ({
    default: module.MailboxPage,
  })),
);

const ConversationAssetsPage = lazy(() =>
  import("@/features/messages/pages/ConversationAssetsPage").then((module) => ({
    default: module.ConversationAssetsPage,
  })),
);

const SearchMessagesPage = lazy(() =>
  import("@/features/messages/pages/SearchMessagesPage").then((module) => ({
    default: module.SearchMessagesPage,
  })),
);

const SavedMessagesPage = lazy(() =>
  import("@/features/messages/pages/SavedMessagesPage").then((module) => ({
    default: module.SavedMessagesPage,
  })),
);

const EventsPage = lazy(() =>
  import("@/features/events/pages/EventsPage").then((module) => ({ default: module.EventsPage })),
);

const EventDetailPage = lazy(() =>
  import("@/features/events/pages/EventDetailPage").then((module) => ({
    default: module.EventDetailPage,
  })),
);

const EventSubmitPage = lazy(() =>
  import("@/features/events/pages/EventSubmitPage").then((module) => ({
    default: module.EventSubmitPage,
  })),
);

const MyEventsPage = lazy(() =>
  import("@/features/events/pages/MyEventsPage").then((module) => ({
    default: module.MyEventsPage,
  })),
);

const MyMomentsPage = lazy(() =>
  import("@/features/moments/pages/MyMomentsPage").then((module) => ({
    default: module.MyMomentsPage,
  })),
);

const MyLikesPage = lazy(() =>
  import("@/features/me-activity/pages/MyLikesPage").then((module) => ({
    default: module.MyLikesPage,
  })),
);

const MyCommentsPage = lazy(() =>
  import("@/features/me-activity/pages/MyCommentsPage").then((module) => ({
    default: module.MyCommentsPage,
  })),
);

const AchievementBadgesPage = lazy(() =>
  import("@/features/me-growth/pages/AchievementBadgesPage").then((module) => ({
    default: module.AchievementBadgesPage,
  })),
);

const ExplorationInterestsPage = lazy(() =>
  import("@/features/me-growth/pages/ExplorationInterestsPage").then((module) => ({
    default: module.ExplorationInterestsPage,
  })),
);

const GroupJoinRequestsPage = lazy(() =>
  import("@/features/me-growth/pages/GroupJoinRequestsPage").then((module) => ({
    default: module.GroupJoinRequestsPage,
  })),
);

const GrowthPage = lazy(() =>
  import("@/features/me-growth/pages/GrowthPage").then((module) => ({
    default: module.GrowthPage,
  })),
);

const MyGroupsPage = lazy(() =>
  import("@/features/me-growth/pages/MyGroupsPage").then((module) => ({
    default: module.MyGroupsPage,
  })),
);

const MyReportsPage = lazy(() =>
  import("@/features/moderation/pages/MyReportsPage").then((module) => ({
    default: module.MyReportsPage,
  })),
);

const ReportDetailPage = lazy(() =>
  import("@/features/moderation/pages/ReportDetailPage").then((module) => ({
    default: module.ReportDetailPage,
  })),
);

const NewReportPage = lazy(() =>
  import("@/features/moderation/pages/NewReportPage").then((module) => ({
    default: module.NewReportPage,
  })),
);

const MyAppealsPage = lazy(() =>
  import("@/features/moderation/pages/MyAppealsPage").then((module) => ({
    default: module.MyAppealsPage,
  })),
);

const AppealDetailPage = lazy(() =>
  import("@/features/moderation/pages/AppealDetailPage").then((module) => ({
    default: module.AppealDetailPage,
  })),
);

const NewAppealPage = lazy(() =>
  import("@/features/moderation/pages/NewAppealPage").then((module) => ({
    default: module.NewAppealPage,
  })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/topics/:slug" element={<TopicDetailPage />} />
        {/* Phase 2K-1: /creators is a PURE FRONT-END AGGREGATION page — there is
            no /api/v1/creators endpoint. It fans out to /topics +
            /topics/{slug}/creators + /users/{username}[/works], all of which are
            already migrated. Guest-readable (every underlying call is public);
            the follow button is the only signed-in action, and it simply fails
            with an auth error for guests. */}
        <Route path="/creators" element={<CreatorsPage />} />
        {/* Phase 2B: public static info. Guest-reachable, no login gate. */}
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
        <Route path="/rules" element={<RulesPage />} />
        {/* Phase 3F: 推荐反馈. Session-scoped on BOTH verbs — `GET` and `POST
            /me/recommendation-feedback` are each 401 for a guest (probed
            2026-09-28; unlike `/explore/me`, these map 401 correctly). Source-
            listed as unverified until now; it is a genuine read+write page.
            The POST takes only `{ body }` (no rating, no target), so the page
            states the scope explicitly. There is NO delete endpoint. */}
        <Route
          path="/feedback/recommendations"
          element={
            <RequireAuth>
              <RecommendationFeedbackPage />
            </RequireAuth>
          }
        />
        {/* Phase 2C: public collection detail. 404 hides PRIVATE/UNLISTED. */}
        <Route path="/collections/:id" element={<CollectionPublicPage />} />
        {/* Phase 2D: public moments. The whole feed is guest-readable;
            only the publish CTA sends guests to login. Publishing lives here as
            a form on the feed page (POST /moments), so there is no /moments/new
            or /moments/:id/edit; the owner's history is /me/moments (Phase 2I-5). */}
        <Route path="/moments" element={<MomentsPage />} />
        <Route path="/moments/:id" element={<MomentDetailPage />} />
        {/* Phase 2G: public series. Guest-readable square + detail; the reader
            needs no session either. Subscribing is the only signed-in action.
            `/series/:id/read` must be declared after `/series` and `/series/:id`
            is unnecessary here — react-router 7 ranks static "read" higher. */}
        <Route path="/series" element={<PublicSeriesListPage />} />
        <Route path="/series/:seriesId" element={<PublicSeriesDetailPage />} />
        <Route path="/series/:seriesId/read" element={<PublicSeriesReadPage />} />
        {/* Phase 2H: public galaxies. Guest-readable square + detail + roster +
            content feed; only joining needs a session. All four are keyed by
            `slug`, which is what the backend routes on. */}
        <Route path="/galaxies" element={<GalaxyListPage />} />
        <Route path="/galaxies/:slug" element={<GalaxyDetailPage />} />
        <Route path="/galaxies/:slug/members" element={<GalaxyMembersPage />} />
        <Route path="/galaxies/:slug/content" element={<GalaxyContentPage />} />
        {/* Phase 3I: 我加入的星系. Same `GET /me/galaxies` call GalaxyShell
            already makes for its join-button state, promoted to a page — the
            public square cannot answer "which ones did I join" because
            GalaxySummary carries no membership flag. RequireAuth: the endpoint
            is session-scoped and a guest gets 401. */}
        <Route
          path="/me/galaxies"
          element={
            <RequireAuth>
              <MyGalaxiesPage />
            </RequireAuth>
          }
        />
        {/* Phase 2I-4: community events. The square and the detail page are
            public and guest-readable (GET /events is unauthenticated); only the
            submit flow and 我的活动 need a session, because registration and
            submission both write under /me/*.
            `/events/:eventId/submit` is declared after `/events/:eventId` —
            react-router 7 ranks the longer literal segment higher, and the test
            file pins that so a future sibling route cannot shadow it. */}
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route
          path="/events/:eventId/submit"
          element={
            <RequireAuth>
              <EventSubmitPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/events"
          element={
            <RequireAuth>
              <MyEventsPage />
            </RequireAuth>
          }
        />
        {/* Phase 1B: real article + public profile */}
        <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
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
        {/* Phase 2I-1: the follow graph. `/me/following` and `/me/followers`
            are the same page in two directions; only 粉丝 offers 关注 back.
            Both need a session (the endpoints are /me/*). */}
        <Route
          path="/me/following"
          element={
            <RequireAuth>
              <MyFollowingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/followers"
          element={
            <RequireAuth>
              <MyFollowersPage />
            </RequireAuth>
          }
        />
        {/* Phase 2I-5: the owner's own moment history. NOT the public feed —
            `/moments` is guest-readable, `/me/moments` is scoped by the session
            (GET /api/v1/me/moments). Publishing stays on `/moments`, which owns
            the compose form; this route is read-only history. */}
        <Route
          path="/me/moments"
          element={
            <RequireAuth>
              <MyMomentsPage />
            </RequireAuth>
          }
        />
        {/* Phase 2J-1: the rest of "我的互动" — the trails the user left behind.
            Both endpoints are /me/* and both return bare arrays, so these are
            read-only, single-read pages behind a session.
            NOTE: `/me/history` is deliberately absent. It exists only as a label
            in Legacy's screen-registry; the backend has no such route (probe:
            500, no handler), so shipping it would be a page that always fails.
            ⚠️ That is NOT the same as "reading history is missing": the real
            endpoint is `/me/reading-history` and it DOES exist (401). Legacy's
            own getHistory() calls it. See LEGACY-DELTA §三·补3 §1b. */}
        <Route
          path="/me/likes"
          element={
            <RequireAuth>
              <MyLikesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/me/comments"
          element={
            <RequireAuth>
              <MyCommentsPage />
            </RequireAuth>
          }
        />
        {/* Phase 3A: 徽章成就. `/me/badges` returns a bare array of a FIXED set
            of five badges; `earned` is derived per request, not stored. Legacy's
            "隐藏徽章" footer and invented "星语探索者" level are NOT reproduced —
            neither has a backend basis. */}
        <Route
          path="/me/badges"
          element={
            <RequireAuth>
              <AchievementBadgesPage />
            </RequireAuth>
          }
        />
        {/* Phase 3B: 成长记录. Aggregates FIVE independent reads, each with its own
            loading/error state so a partial failure is visible per section rather
            than blanking the page. Reading history is `/me/reading-history` (which
            exists) — NOT `/me/history` (which does not). See LEGACY-DELTA §三·补14. */}
        <Route
          path="/me/growth"
          element={
            <RequireAuth>
              <GrowthPage />
            </RequireAuth>
          }
        />
        {/* Phase 3C: 关系请求. Despite Legacy's broad page title, the backend has
            NO follow-request concept — following is open (`JoinMode.OPEN`), so the
            only thing that can appear here is a group JOIN REQUEST the caller
            submitted (`GET /me/group-join-requests`). The owner-side approve/reject
            queue is NOT shipped, so no "去处理" affordance exists here. See §三·补15. */}
        <Route
          path="/me/requests"
          element={
            <RequireAuth>
              <GroupJoinRequestsPage />
            </RequireAuth>
          }
        />
        {/* Phase 3D: 我的探索 (兴趣). Writes the caller's own exploration
            preferences — a DESTRUCTIVE full replacement server-side, so the page
            always sends complete state and skips the PUT when nothing changed.
            ⚠️ `GET /explore/me` returns 500 (not 401) for a guest: the controller
            declares `@RequestHeader("satoken")` without `required = false`, so
            Spring's MissingRequestHeaderException pre-empts the handler's own
            401 mapping. See §三·补16. */}
        <Route
          path="/me/interests"
          element={
            <RequireAuth>
              <ExplorationInterestsPage />
            </RequireAuth>
          }
        />
        {/* Phase 3E: 我的群聊. One read (`GET /messages`, a bare array mixing
            DIRECT + GROUP) filtered client-side, plus the ONLY create surface —
            `POST /messages/group` in an inline form, so no /messages/groups/new
            route is needed (and Legacy's shape never existed there anyway).
            Rows link to /messages/:conversationId, which V2 serves for GROUP. */}
        <Route
          path="/me/groups"
          element={
            <RequireAuth>
              <MyGroupsPage />
            </RequireAuth>
          }
        />
        {/* Phase 2J-2: 举报与申诉. Note the route shape mirrors Legacy's real
            pages: the list/detail/create pages live at the RESOURCE ROOT
            (/reports, /appeals), not under /me — even though the read endpoints
            are /me/reports and /me/appeals. The write endpoints really are at
            the root (POST /reports, POST /appeals), so the route names match
            the API shape the user is acting on.
            All six are RequireAuth: every endpoint is session-scoped.
            Route order matters — /reports/new must precede /reports/:reportId,
            otherwise "new" would be parsed as a report id. React Router 7
            ranks the static segment higher, so the order below is safe either
            way, but the intent is clearer written in this order. */}
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <MyReportsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports/new"
          element={
            <RequireAuth>
              <NewReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <RequireAuth>
              <ReportDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/appeals"
          element={
            <RequireAuth>
              <MyAppealsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/appeals/new"
          element={
            <RequireAuth>
              <NewAppealPage />
            </RequireAuth>
          }
        />
        <Route
          path="/appeals/:appealId"
          element={
            <RequireAuth>
              <AppealDetailPage />
            </RequireAuth>
          }
        />
        {/* Phase 2I-2: the notification centre. The endpoint is /api/v1/notifications
            (session-scoped), so this needs a login like the follow lists. */}
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />{" "}
        {/* Phase 2I-3: the private message centre. Both hosts need a session —
            every /api/v1/messages endpoint is scoped by the community session.
            Declared as two flat routes (not a nested index/child pair) because
            MailboxPage renders the thread slot itself from the param. */}
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <MailboxPage />
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <RequireAuth>
              <MailboxPage />
            </RequireAuth>
          }
        />
        {/* Phase 2I-3b: mailbox-wide message search and the two shared-media
            views for one conversation. All three need a session for the same
            reason as above.

            `/messages/search` is declared alongside `/messages/:conversationId`
            and NOT nested under it: it is a sibling page, and react-router 7
            ranks a static segment above a dynamic one, so the literal "search"
            wins over the param. That ranking is pinned by a test rather than
            assumed — a future route added here could flip it and silently send
            "search" down the conversation path. */}
        <Route
          path="/messages/search"
          element={
            <RequireAuth>
              <SearchMessagesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId/media"
          element={
            <RequireAuth>
              <ConversationAssetsPage kind="media" />
            </RequireAuth>
          }
        />
        <Route
          path="/messages/:conversationId/files"
          element={
            <RequireAuth>
              <ConversationAssetsPage kind="files" />
            </RequireAuth>
          }
        />
        {/* Phase 3I: 收藏的私信. A sibling of the mailbox rather than a child —
            `/me/saved-messages` is a bookmark store independent of any open
            conversation, and its rows deep-link INTO /messages/:id. RequireAuth
            for the same reason as every other /messages page. */}
        <Route
          path="/messages/saved"
          element={
            <RequireAuth>
              <SavedMessagesPage />
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
        {/* Phase 3G: content management. This is the LIST route the editor's
            comments kept referring to as missing. React Router ranks
            `/studio/content/:articleId` above nothing here — both are declared,
            and the static segment wins for the exact path `/studio/content`. */}
        <Route
          path="/studio/content"
          element={
            <RequireAuth>
              <ContentListPage />
            </RequireAuth>
          }
        />
        {/* Phase 2K-2: review submissions. Both are session-scoped
            (`/me/submissions*`), so RequireAuth on both.

            NOTE the paths are `/studio/submissions*`, NOT `/me/submissions*`:
            Legacy hosted this at `/studio/submissions/{id}` and the studio is
            where a writer looks for their own submissions. The API path stays
            `/me/*`. */}
        <Route
          path="/studio/submissions"
          element={
            <RequireAuth>
              <MySubmissionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/submissions/:submissionId"
          element={
            <RequireAuth>
              <SubmissionDetailPage />
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
          {/* Phase 3H: account security + data sovereignty. All four are real
              self-service endpoints (email change, data export, account
              deactivation) plus the re-auth grant the email change depends on. */}
          <Route path="/settings/security/email" element={<SettingsEmailPage />} />
          <Route
            path="/settings/security/re-authenticate"
            element={<SettingsReauthenticatePage />}
          />
          <Route path="/settings/data/export" element={<SettingsDataExportPage />} />
          <Route path="/settings/data/delete-account" element={<SettingsDeleteAccountPage />} />
        </Route>
        {/* Phase 2L: version history and analytics. Both are owner-only views of
            data the API already exposes (listRevisions / me/insights). */}
        <Route
          path="/studio/analytics"
          element={
            <RequireAuth>
              <StudioAnalyticsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/content/:articleId/versions"
          element={
            <RequireAuth>
              <ArticleVersionsPage />
            </RequireAuth>
          }
        />
        {/* Phase 2M: collaboration invites. Both pages are RequireAuth.
            The invite format is a strictly POST-a-session operation
            (`POST /me/collaboration-invites`). Accept (`POST
            /collaboration/invites/accept`) ALSO needs a session even though
            resolve (`GET /collaboration/invites/resolve`) is public — gating both
            keeps the flow coherent, and a guest simply gets bounced to login.

            ⚠️ `/studio/collaboration/accept` is declared AFTER
            `/studio/collaboration` on purpose. They are siblings (accept is not a
            child of the create page), and React Router 7 would rank the static
            "accept" segment above the param if one were introduced — but the
            intent is clearer written in this order.

            ⚠️ Neither page implies a working collaboration handshake: the backend
            has no relationship table and accept writes nothing. See
            collaboration.types.ts. */}
        <Route
          path="/studio/collaboration"
          element={
            <RequireAuth>
              <CollaborationInvitePage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio/collaboration/accept"
          element={
            <RequireAuth>
              <CollaborationAcceptPage />
            </RequireAuth>
          }
        />
        {/* Phase 2N: creation-space categories. Not a migration — the backend
            CRUD (`/me/creation-space/categories`) was fully implemented while
            Legacy shipped no page for it (`app/studio/categories/` has no
            page.tsx, and its redirect sends /studio/categories to the empty
            /studio/settings shell). RequireAuth: every endpoint needs a session. */}
        <Route
          path="/studio/categories"
          element={
            <RequireAuth>
              <StudioCategoriesPage />
            </RequireAuth>
          }
        />
        {/* Phase 1C-1: editor. One route covers both "existing draft" and
            "new article" (Legacy used the same magic `new` id). */}
        <Route
          path="/studio/content/:articleId"
          element={
            <RequireAuth>
              <EditorPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/*
        Auth screens, split by the WIDTH the screen actually needs (2026-10-03).

        These were one `<AuthLayout />` group with a hard-coded `max-w-md`. That is
        the right column for a form and the wrong one for a two-column screen, so
        the layout now takes a `width` variant and the groups declare it:

          narrow  every single-column screen — login, the two password resets,
                  email verification, pending audit, forced password change
          wide    register, which puts the form beside the reason to fill it in

        Two groups rather than one with per-route config because the app mounts
        `<Routes>` declaratively inside a splat route: `useMatches()` reports only
        that splat match, so a layout cannot discover which child auth page is
        active. Splitting the group is the only way to vary the layout per screen.

        Path matching is unchanged — the same seven paths resolve to the same
        seven elements, just under two parents instead of one.
      */}
      <Route element={<AuthLayout width="narrow" />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/pending-audit" element={<PendingAuditPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/force-change-password" element={<ForceChangePasswordPage />} />
      </Route>

      <Route element={<AuthLayout width="wide" />}>
        <Route path="/register" element={<RegisterPage />} />
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
