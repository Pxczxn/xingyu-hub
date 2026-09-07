package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.AccountStatusView;
import top.pxczxn.xingyu.community.dto.CollectionItemView;
import top.pxczxn.xingyu.community.dto.CollectionSummaryView;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.MeView;
import top.pxczxn.xingyu.community.dto.OnboardingView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.ProfileView;
import top.pxczxn.xingyu.community.dto.SessionView;
import top.pxczxn.xingyu.community.dto.ApiTokenCreatedView;
import top.pxczxn.xingyu.community.dto.ApiTokenView;
import top.pxczxn.xingyu.community.dto.AppealDetailView;
import top.pxczxn.xingyu.community.dto.EventSubmissionView;
import top.pxczxn.xingyu.community.dto.FollowUserView;
import top.pxczxn.xingyu.community.dto.GalaxyView;
import top.pxczxn.xingyu.community.dto.MyCommentView;
import top.pxczxn.xingyu.community.dto.MyLikeView;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.BlockedUserView;
import top.pxczxn.xingyu.community.dto.ReportSupplementView;
import top.pxczxn.xingyu.community.dto.ReviewSubmissionDetailView;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.dto.UserReportDetailView;
import top.pxczxn.xingyu.community.dto.UserReportView;
import top.pxczxn.xingyu.community.dto.BadgeView;
import top.pxczxn.xingyu.community.dto.CollaborationInviteView;
import top.pxczxn.xingyu.community.dto.InsightsView;
import top.pxczxn.xingyu.community.dto.RecommendationFeedbackView;
import top.pxczxn.xingyu.community.service.ClientSettingsService;
import top.pxczxn.xingyu.community.service.CollectionService;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.CommunityEventService;
import top.pxczxn.xingyu.community.service.CommunityProfileService;
import top.pxczxn.xingyu.community.service.GalaxyService;
import top.pxczxn.xingyu.community.service.ModerationService;
import top.pxczxn.xingyu.community.service.MomentService;
import top.pxczxn.xingyu.community.service.OnboardingService;
import top.pxczxn.xingyu.community.service.ReadingService;
import top.pxczxn.xingyu.community.service.RecentAuthenticationService;
import top.pxczxn.xingyu.community.service.ReviewService;
import top.pxczxn.xingyu.community.service.ConversationService;
import top.pxczxn.xingyu.community.dto.MyGroupJoinRequestView;
import top.pxczxn.xingyu.community.dto.SavedMessageView;
import top.pxczxn.xingyu.community.service.CollaborationService;
import top.pxczxn.xingyu.community.service.CommunityApiTokenService;
import top.pxczxn.xingyu.community.service.DataExportService;
import top.pxczxn.xingyu.community.service.MeEngagementService;
import top.pxczxn.xingyu.community.service.RecommendationFeedbackService;
import top.pxczxn.xingyu.community.service.SavedMessageService;
import top.pxczxn.xingyu.community.service.SocialService;
import top.pxczxn.xingyu.community.service.UserBlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/me")
@RequiredArgsConstructor
public class CommunityMeController {

    private final CommunityAccountService accountService;
    private final CommunityProfileService profileService;
    private final RecentAuthenticationService recentAuthenticationService;
    private final OnboardingService onboardingService;
    private final CollectionService collectionService;
    private final ReadingService readingService;
    private final ModerationService moderationService;
    private final SocialService socialService;
    private final UserBlockService userBlockService;
    private final MomentService momentService;
    private final CommunityEventService eventService;
    private final GalaxyService galaxyService;
    private final ReviewService reviewService;
    private final ConversationService conversationService;
    private final ClientSettingsService clientSettingsService;
    private final SavedMessageService savedMessageService;
    private final RecommendationFeedbackService recommendationFeedbackService;
    private final MeEngagementService meEngagementService;
    private final DataExportService dataExportService;
    private final CollaborationService collaborationService;
    private final CommunityApiTokenService apiTokenService;

    @GetMapping
    public MeView me() {
        return accountService.currentUser(CommunityAuthContext.requireUser());
    }

    @GetMapping("/sessions")
    public List<SessionView> sessions(@RequestHeader("satoken") String token) {
        return accountService.listSessions(CommunityAuthContext.requireUser(), token);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            @PathVariable String sessionId,
            @RequestHeader("satoken") String token) {
        accountService.revokeSession(CommunityAuthContext.requireUser(), sessionId, token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sessions/revoke-others")
    public ResponseEntity<Void> revokeOthers(@RequestHeader("satoken") String token) {
        accountService.revokeOtherSessions(CommunityAuthContext.requireUser(), token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email/change")
    public Map<String, Object> changeEmail(
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Recent-Auth", required = false) String recentAuthId) {
        return accountService.changeEmail(
                CommunityAuthContext.requireUser(),
                CommunityAuthContext.requireSession(),
                recentAuthId,
                body.get("newEmail"),
                body.get("password"));
    }

    @GetMapping("/account-status")
    public AccountStatusView accountStatus() {
        return recentAuthenticationService.accountStatus(CommunityAuthContext.requireUser());
    }

    @GetMapping("/profile")
    public ProfileView profile() {
        return profileService.getProfile(CommunityAuthContext.requireUser());
    }

    @PatchMapping("/profile")
    public ProfileView updateProfile(@RequestBody Map<String, Object> body) {
        return profileService.updateProfile(CommunityAuthContext.requireUser(), body);
    }

    @PatchMapping("/profile/privacy")
    public ProfileView updatePrivacy(@RequestBody Map<String, String> body) {
        return profileService.updatePrivacy(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/onboarding")
    public OnboardingView onboarding() {
        return onboardingService.get(CommunityAuthContext.requireUser());
    }

    @PatchMapping("/onboarding")
    public OnboardingView updateOnboarding(@RequestBody Map<String, Object> body) {
        return onboardingService.update(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/collections")
    public List<CollectionSummaryView> collections() {
        return collectionService.listMine(CommunityAuthContext.requireUser());
    }

    @PostMapping("/collections")
    public CollectionSummaryView createCollection(@RequestBody Map<String, String> body) {
        return collectionService.create(
                CommunityAuthContext.requireUser(),
                body.get("title"),
                body.get("visibility"));
    }

    @PostMapping("/collections/{collectionId}/items")
    public CollectionItemView addCollectionItem(
            @PathVariable String collectionId,
            @RequestBody Map<String, String> body) {
        return collectionService.addItem(
                CommunityAuthContext.requireUser(),
                collectionId,
                body.get("objectType"),
                body.get("objectId"));
    }

    @PostMapping("/bookmarks")
    public CollectionItemView bookmark(@RequestBody Map<String, String> body) {
        return collectionService.bookmark(
                CommunityAuthContext.requireUser(),
                body.get("objectType"),
                body.get("objectId"));
    }

    @GetMapping("/bookshelf")
    public PageResultView<ContentCardView> bookshelf(
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "cursor", required = false) String cursor) {
        return readingService.bookshelf(CommunityAuthContext.requireUser(), limit, cursor);
    }

    @GetMapping("/reading-history")
    public PageResultView<ContentCardView> readingHistory(
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "cursor", required = false) String cursor) {
        return readingService.readingHistory(CommunityAuthContext.requireUser(), limit, cursor);
    }

    @PostMapping("/reading-progress")
    public ResponseEntity<Void> recordReadingProgress(@RequestBody Map<String, String> body) {
        readingService.recordProgress(
                CommunityAuthContext.requireUser(),
                body.get("seriesId"),
                body.get("articleId"));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/reports")
    public List<UserReportView> myReports() {
        return moderationService.listMyReports(CommunityAuthContext.requireUser());
    }

    @GetMapping("/reports/{reportId}")
    public UserReportDetailView myReport(@PathVariable String reportId) {
        return moderationService.getMyReport(CommunityAuthContext.requireUser(), reportId);
    }

    @PostMapping("/reports/{reportId}/supplements")
    public ReportSupplementView addReportSupplement(
            @PathVariable String reportId,
            @RequestBody Map<String, String> body) {
        return moderationService.addReportSupplement(
                CommunityAuthContext.requireUser(), reportId, body);
    }

    @GetMapping("/following")
    public PageResultView<FollowUserView> following(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return socialService.listFollowing(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/followers")
    public PageResultView<FollowUserView> followers(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return socialService.listFollowers(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/comments")
    public List<MyCommentView> myComments(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return socialService.listMyComments(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/likes")
    public List<MyLikeView> myLikes(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return socialService.listMyLikes(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/moments")
    public List<MomentView> myMoments(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return momentService.listMine(CommunityAuthContext.requireUser(), limit);
    }

    @PatchMapping("/moments/{momentId}")
    public MomentView updateMoment(
            @PathVariable String momentId,
            @RequestBody Map<String, String> body) {
        return momentService.update(CommunityAuthContext.requireUser(), momentId, body);
    }

    @PostMapping("/moments/{momentId}/trash")
    public MomentView trashMoment(@PathVariable String momentId) {
        return momentService.trash(CommunityAuthContext.requireUser(), momentId);
    }

    @GetMapping("/blocks")
    public List<BlockedUserView> blockedUsers(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return userBlockService.listBlocked(CommunityAuthContext.requireUser(), limit);
    }

    @PostMapping("/blocks/{username}")
    public ResponseEntity<Void> blockUser(@PathVariable String username) {
        userBlockService.blockByUsername(CommunityAuthContext.requireUser(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/blocks/{username}")
    public ResponseEntity<Void> unblockUser(@PathVariable String username) {
        userBlockService.unblockByUsername(CommunityAuthContext.requireUser(), username);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/events/{eventId}/submissions")
    public EventSubmissionView submitEvent(
            @PathVariable String eventId,
            @RequestBody Map<String, String> body) {
        return eventService.submit(CommunityAuthContext.requireUser(), eventId, body);
    }

    @PostMapping("/events/{eventId}/register")
    public Map<String, Object> registerEvent(@PathVariable String eventId) {
        return eventService.register(CommunityAuthContext.requireUser(), eventId);
    }

    @DeleteMapping("/events/{eventId}/register")
    public ResponseEntity<Void> cancelEventRegistration(@PathVariable String eventId) {
        eventService.cancelRegistration(CommunityAuthContext.requireUser(), eventId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/event-submissions")
    public List<EventSubmissionView> myEventSubmissions(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return eventService.listMySubmissions(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/galaxies")
    public List<GalaxyView> myGalaxies() {
        return galaxyService.listMine(CommunityAuthContext.requireUser());
    }

    @GetMapping("/appeals")
    public List<AppealDetailView> myAppeals(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return moderationService.listMyAppeals(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/appeals/{appealId}")
    public AppealDetailView myAppeal(@PathVariable String appealId) {
        return moderationService.getMyAppeal(CommunityAuthContext.requireUser(), appealId);
    }

    @GetMapping("/submissions")
    public List<ReviewSubmissionDetailView> mySubmissions(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return reviewService.listMySubmissions(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/submissions/{submissionId}")
    public ReviewSubmissionDetailView mySubmission(@PathVariable String submissionId) {
        return reviewService.getSubmissionForOwner(CommunityAuthContext.requireUser(), submissionId);
    }

    @PostMapping("/submissions/{submissionId}/withdraw")
    public ReviewSubmission withdrawSubmission(@PathVariable String submissionId) {
        return reviewService.withdraw(CommunityAuthContext.requireUser(), submissionId);
    }

    @GetMapping("/client-settings")
    public Map<String, Object> clientSettings() {
        return clientSettingsService.getSettings(CommunityAuthContext.requireUser());
    }

    @PutMapping("/client-settings")
    public Map<String, Object> updateClientSettings(@RequestBody Map<String, Object> body) {
        return clientSettingsService.updateSettings(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/saved-messages")
    public List<SavedMessageView> savedMessages(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return savedMessageService.listSaved(CommunityAuthContext.requireUser(), limit);
    }

    @PostMapping("/saved-messages")
    public SavedMessageView saveMessage(@RequestBody Map<String, String> body) {
        return savedMessageService.saveMessage(
                CommunityAuthContext.requireUser(),
                body.get("messageId"));
    }

    @DeleteMapping("/saved-messages/{messageId}")
    public ResponseEntity<Void> removeSavedMessage(@PathVariable String messageId) {
        savedMessageService.removeSaved(CommunityAuthContext.requireUser(), messageId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/group-join-requests")
    public List<MyGroupJoinRequestView> myGroupJoinRequests(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return conversationService.listMyGroupJoinRequests(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/recommendation-feedback")
    public List<RecommendationFeedbackView> recommendationFeedback(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return recommendationFeedbackService.listMine(CommunityAuthContext.requireUser(), limit);
    }

    @PostMapping("/recommendation-feedback")
    public RecommendationFeedbackView submitRecommendationFeedback(@RequestBody Map<String, String> body) {
        return recommendationFeedbackService.submit(CommunityAuthContext.requireUser(), body.get("body"));
    }

    @GetMapping("/badges")
    public List<BadgeView> badges() {
        return meEngagementService.badges(CommunityAuthContext.requireUser());
    }

    @GetMapping("/insights")
    public InsightsView insights() {
        return meEngagementService.insights(CommunityAuthContext.requireUser());
    }

    @GetMapping("/data-export")
    public Map<String, Object> dataExport() {
        return dataExportService.export(CommunityAuthContext.requireUser());
    }

    @PostMapping("/account/deletion-request")
    public ResponseEntity<Void> requestAccountDeletion() {
        accountService.requestAccountDeletion(CommunityAuthContext.requireUser());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/collections/{collectionId}")
    public CollectionSummaryView updateCollection(
            @PathVariable String collectionId,
            @RequestBody Map<String, String> body) {
        return collectionService.updateCollection(
                CommunityAuthContext.requireUser(),
                collectionId,
                body.get("title"),
                body.get("visibility"));
    }

    @DeleteMapping("/collections/{collectionId}")
    public ResponseEntity<Void> deleteCollection(@PathVariable String collectionId) {
        collectionService.deleteCollection(CommunityAuthContext.requireUser(), collectionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/collections/{collectionId}/items/{itemId}")
    public ResponseEntity<Void> removeCollectionItem(
            @PathVariable String collectionId,
            @PathVariable String itemId) {
        collectionService.removeItem(CommunityAuthContext.requireUser(), collectionId, itemId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/collections/{collectionId}/items/{itemId}/move")
    public CollectionItemView moveCollectionItem(
            @PathVariable String collectionId,
            @PathVariable String itemId,
            @RequestBody Map<String, String> body) {
        return collectionService.moveItem(
                CommunityAuthContext.requireUser(),
                collectionId,
                itemId,
                body.get("targetCollectionId"));
    }

    @DeleteMapping("/bookmarks")
    public ResponseEntity<Void> removeBookmark(@RequestBody Map<String, String> body) {
        collectionService.removeBookmark(
                CommunityAuthContext.requireUser(),
                body.get("objectType"),
                body.get("objectId"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/collaboration-invites")
    public CollaborationInviteView createCollaborationInvite(@RequestBody Map<String, String> body) {
        return collaborationService.createInvite(
                CommunityAuthContext.requireUser(),
                body.get("note"));
    }

    @GetMapping("/api-tokens")
    public List<ApiTokenView> apiTokens(@RequestParam(value = "limit", defaultValue = "20") int limit) {
        return apiTokenService.listMine(CommunityAuthContext.requireUser(), limit);
    }

    @PostMapping("/api-tokens")
    public ApiTokenCreatedView createApiToken(@RequestBody Map<String, Object> body) {
        return apiTokenService.create(CommunityAuthContext.requireUser(), body);
    }

    @DeleteMapping("/api-tokens/{tokenId}")
    public ResponseEntity<Void> revokeApiToken(@PathVariable String tokenId) {
        apiTokenService.revoke(CommunityAuthContext.requireUser(), tokenId);
        return ResponseEntity.noContent().build();
    }
}
