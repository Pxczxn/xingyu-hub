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
import { CreatorsPage } from "@/features/creators/pages/CreatorsPage";
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
import { MySubmissionsPage } from "@/features/studio/pages/MySubmissionsPage";
import { SubmissionDetailPage } from "@/features/studio/pages/SubmissionDetailPage";
import { ArticleVersionsPage } from "@/features/studio/pages/ArticleVersionsPage";
import { StudioAnalyticsPage } from "@/features/studio/pages/StudioAnalyticsPage";
import { CollaborationInvitePage } from "@/features/studio/pages/CollaborationInvitePage";
import { CollaborationAcceptPage } from "@/features/studio/pages/CollaborationAcceptPage";
import { StudioCategoriesPage } from "@/features/studio/pages/StudioCategoriesPage";
import { SeriesListPage } from "@/features/series/pages/SeriesListPage";
import { SeriesNewPage } from "@/features/series/pages/SeriesNewPage";
import { SeriesEditPage } from "@/features/series/pages/SeriesEditPage";
import { SeriesArticlesPage } from "@/features/series/pages/SeriesArticlesPage";
import { PublicSeriesListPage } from "@/features/series/pages/PublicSeriesListPage";
import { PublicSeriesDetailPage } from "@/features/series/pages/PublicSeriesDetailPage";
import { PublicSeriesReadPage } from "@/features/series/pages/PublicSeriesReadPage";
import { GalaxyListPage } from "@/features/galaxies/pages/GalaxyListPage";
import { GalaxyDetailPage } from "@/features/galaxies/pages/GalaxyDetailPage";
import { GalaxyMembersPage } from "@/features/galaxies/pages/GalaxyMembersPage";
import { GalaxyContentPage } from "@/features/galaxies/pages/GalaxyContentPage";
import { MyFollowingPage, MyFollowersPage } from "@/features/social/pages/FollowListPage";
import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage";
import { MailboxPage } from "@/features/messages/pages/MailboxPage";
import { ConversationAssetsPage } from "@/features/messages/pages/ConversationAssetsPage";
import { SearchMessagesPage } from "@/features/messages/pages/SearchMessagesPage";
import { EventsPage } from "@/features/events/pages/EventsPage";
import { EventDetailPage } from "@/features/events/pages/EventDetailPage";
import { EventSubmitPage } from "@/features/events/pages/EventSubmitPage";
import { MyEventsPage } from "@/features/events/pages/MyEventsPage";
import { MyMomentsPage } from "@/features/moments/pages/MyMomentsPage";
import { MyLikesPage } from "@/features/me-activity/pages/MyLikesPage";
import { MyCommentsPage } from "@/features/me-activity/pages/MyCommentsPage";
import { MyReportsPage } from "@/features/moderation/pages/MyReportsPage";
import { ReportDetailPage } from "@/features/moderation/pages/ReportDetailPage";
import { NewReportPage } from "@/features/moderation/pages/NewReportPage";
import { MyAppealsPage } from "@/features/moderation/pages/MyAppealsPage";
import { AppealDetailPage } from "@/features/moderation/pages/AppealDetailPage";
import { NewAppealPage } from "@/features/moderation/pages/NewAppealPage";
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
            500, no handler), so shipping it would be a page that always fails. */}
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
        />        {/* Phase 2I-3: the private message centre. Both hosts need a session —
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
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <StudioPage />
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
