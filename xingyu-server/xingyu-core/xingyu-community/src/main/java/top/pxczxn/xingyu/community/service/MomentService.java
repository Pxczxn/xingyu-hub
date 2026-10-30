package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MomentService {

    /** The social object type moments are stored under in likes / comments. */
    private static final String OBJECT_TYPE = "MOMENT";

    /** Public list endpoints are browse surfaces; a caller cannot ask for the whole table. */
    private static final int MAX_PUBLIC_LIST_LIMIT = 50;

    private final MomentMapper momentMapper;
    private final CommunityProfileMapper profileMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final CommunityProperties communityProperties;
    private final CommunityEventSupport eventSupport;
    private final EngagementMetricsService engagementMetrics;

    /**
     * The public feed, with engagement counters attached.
     *
     * <p>Counters are batched, not per row. `GET /likes/MOMENT/{id}/count` is public, but a
     * 20-card feed asking it 20 times is an N+1 that grows with the page size, so the three
     * numbers come from {@link EngagementMetricsService} instead — two grouped queries plus one
     * viewer-scoped id query, regardless of how many moments the page holds.
     *
     * <p>A guest gets `liked: null` rather than `false`; see {@link MomentView#getLiked()}.
     */
    public List<MomentView> listPublished(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        limit = Math.min(limit, MAX_PUBLIC_LIST_LIMIT);
        String viewerId = CommunityAuthContext.currentUser().map(CommunityUser::getId).orElse(null);
        return withViewerMetrics(momentMapper.listPublished(limit), viewerId);
    }

    /**
     * A public profile's published moments, newest first.
     *
     * <p>Same counters and viewer-scoped `liked` flag as the public feed: a profile list is a
     * browse surface, not the owner's write-back view. The caller resolves the username and the
     * profile visibility first; this method only knows the author id.
     *
     * <p>The viewer id is passed explicitly rather than read from {@link CommunityAuthContext}:
     * the profile endpoints accept an optional session and resolve it in the controller, so the
     * thread-local context is not guaranteed to be populated on this path.
     */
    public List<MomentView> listPublishedByAuthor(String authorId, int limit, String viewerId) {
        if (limit <= 0) {
            limit = 20;
        }
        limit = Math.min(limit, MAX_PUBLIC_LIST_LIMIT);
        return withViewerMetrics(momentMapper.listByAuthorId(authorId, limit), viewerId);
    }

    private List<MomentView> withViewerMetrics(List<Moment> moments, String viewerId) {
        if (moments.isEmpty()) {
            return List.of();
        }
        List<String> ids = moments.stream().map(Moment::getId).toList();
        Map<String, Long> likeCounts = engagementMetrics.likeCounts(OBJECT_TYPE, ids);
        Map<String, Long> commentCounts = engagementMetrics.commentCounts(OBJECT_TYPE, ids);
        Set<String> likedIds =
                viewerId == null
                        ? Set.of()
                        : engagementMetrics.likedObjectIds(viewerId, OBJECT_TYPE, ids);
        return moments.stream()
                .map(moment -> withMetrics(moment, likeCounts, commentCounts, likedIds, viewerId != null))
                .toList();
    }

    public List<MomentView> listMine(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return momentMapper.listByAuthorId(user.getId(), limit).stream()
                .map(this::toView)
                .toList();
    }

    public MomentView getById(String momentId) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !"PUBLISHED".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(moment);
    }

    @Transactional
    public MomentView publish(CommunityUser user, Map<String, String> body) {
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new FieldContractException("body", "动态正文不能为空");
        }
        Instant now = Instant.now();
        Moment moment = new Moment();
        moment.setId(TokenSupport.newId());
        moment.setAuthorId(user.getId());
        moment.setStatus("PUBLISHED");
        moment.setCreatedAt(now);
        moment.setUpdatedAt(now);
        momentMapper.insert(moment);

        MomentRevision revision = new MomentRevision();
        revision.setId(TokenSupport.newId());
        revision.setMomentId(moment.getId());
        revision.setBody(text.trim());
        revision.setRevisionNumber(1);
        revision.setCreatedAt(now);
        momentRevisionMapper.insert(revision);
        publishMomentChanged(moment);
        return toView(moment);
    }

    @Transactional
    public MomentView update(CommunityUser user, String momentId, Map<String, String> body) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !user.getId().equals(moment.getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!"PUBLISHED".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "只能编辑已发布的动态");
        }
        long elapsed = Instant.now().getEpochSecond() - moment.getCreatedAt().getEpochSecond();
        if (elapsed > communityProperties.getMomentEditWindowSeconds()) {
            throw new ContractException(ErrorCode.CONFLICT, "已超过可编辑时间窗口");
        }
        String text = body.get("body");
        if (text == null || text.isBlank()) {
            throw new FieldContractException("body", "动态正文不能为空");
        }
        Instant now = Instant.now();
        MomentRevision latest = momentRevisionMapper.findLatestByMomentId(momentId);
        int nextRevision = latest == null ? 1 : latest.getRevisionNumber() + 1;
        MomentRevision revision = new MomentRevision();
        revision.setId(TokenSupport.newId());
        revision.setMomentId(momentId);
        revision.setBody(text.trim());
        revision.setRevisionNumber(nextRevision);
        revision.setCreatedAt(now);
        momentRevisionMapper.insert(revision);
        moment.setUpdatedAt(now);
        momentMapper.updateById(moment);
        publishMomentChanged(moment);
        return toView(moment);
    }

    @Transactional
    public MomentView trash(CommunityUser user, String momentId) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !user.getId().equals(moment.getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        moment.setStatus("TRASHED");
        moment.setUpdatedAt(Instant.now());
        momentMapper.updateById(moment);
        publishMomentChanged(moment);
        return toView(moment);
    }

    /**
     * Queues a moment index refresh.
     *
     * <p>⚠️ LENGTH MATTERS. `reliable_event.event_id` is varchar(64) and a moment id alone is
     * 36 characters, so the prefix has to stay short. A first cut used
     * {@code "moment-changed:" + id + ":" + epochMilli} = 65 characters, which made MySQL
     * reject the insert and turned every moment creation into a 500.
     *
     * <p>The event id is keyed on `updatedAt`, which every mutation (publish / update / trash)
     * bumps, so distinct mutations produce distinct events while a retry of the same mutation
     * is deduplicated by the outbox.
     */
    private void publishMomentChanged(Moment moment) {
        long stamp = moment.getUpdatedAt() == null ? 0L : moment.getUpdatedAt().toEpochMilli();
        eventSupport.publishContentEvent(
                "moment:" + moment.getId() + ":" + stamp,
                CommunityEventSupport.MOMENT_CHANGED,
                CommunityEventSupport.AGGREGATE_TYPE_MOMENT,
                moment.getId());
    }

    // Package-private, not private, so the author resolution can be unit-tested
    // with mocked mappers — no database required.
    MomentView toView(Moment moment) {
        return toView(moment, null, null, null);
    }

    private MomentView withMetrics(
            Moment moment,
            Map<String, Long> likeCounts,
            Map<String, Long> commentCounts,
            Set<String> likedIds,
            boolean signedIn) {
        /*
         * The ternary is not decoration. `signedIn && likedIds.contains(id)` is a PRIMITIVE
         * boolean, so it autoboxes to Boolean.FALSE for a guest — and the guest's `null` ("we
         * never asked") silently becomes `false` ("asked, not liked"), which would render the
         * 登录后互动 link as an un-liked button. Caught by
         * MomentFeedCountersIntegrationTest#guestGetsNullLikedRatherThanFalse.
         */
        Boolean liked = signedIn ? likedIds.contains(moment.getId()) : null;
        return toView(
                moment,
                likeCounts.getOrDefault(moment.getId(), 0L),
                commentCounts.getOrDefault(moment.getId(), 0L),
                liked);
    }

    private MomentView toView(Moment moment, Long likeCount, Long commentCount, Boolean liked) {
        MomentRevision revision = momentRevisionMapper.findLatestByMomentId(moment.getId());
        /*
         * Resolve the author here rather than leaving it to the client.
         *
         * `authorId` was the only author information on this DTO, so a moment
         * feed could not say who wrote anything without one extra request per
         * row — and the feed shows many rows. One profile lookup per moment is
         * the cheaper trade, and it matches how ConversationService resolves a
         * direct conversation's counterpart.
         *
         * A missing profile yields nulls, not blanks: the client decides what to
         * print for an unknown author.
         */
        CommunityProfile profile = profileMapper.findByUserId(moment.getAuthorId());
        return MomentView.builder()
                .id(moment.getId())
                .body(revision == null ? null : revision.getBody())
                .authorId(moment.getAuthorId())
                .authorUsername(profile == null ? null : profile.getUsername())
                .authorDisplayName(profile == null ? null : profile.getDisplayName())
                .createdAt(moment.getCreatedAt())
                .likeCount(likeCount)
                .commentCount(commentCount)
                .liked(liked)
                .build();
    }
}
