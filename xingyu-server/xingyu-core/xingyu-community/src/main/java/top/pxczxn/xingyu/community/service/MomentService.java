package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.CursorCodec;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
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
    private final SearchIndexService searchIndexService;

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
     * A public profile's published moments, newest first, one keyset page at a time.
     *
     * <p>Same counters and viewer-scoped `liked` flag as the public feed: a profile list is a
     * browse surface, not the owner's write-back view. The caller resolves the username and the
     * profile visibility first; this method only knows the author id.
     *
     * <p>The viewer id is passed explicitly rather than read from {@link CommunityAuthContext}:
     * the profile endpoints accept an optional session and resolve it in the controller, so the
     * thread-local context is not guaranteed to be populated on this path.
     *
     * <p>Paged rather than capped: the profile renders a count from the profile DTO and a list
     * from here, so a fixed window would sooner or later show "动态 60" above 20 rows with no way
     * to reach the rest. The cursor is the same opaque triple the discover feed uses
     * ({@link top.pxczxn.xingyu.community.support.CursorCodec}), keyed on
     * {@code (created_at, id)}; a malformed cursor is a client error (400), not a silent reset.
     */
    public PageResultView<MomentView> listPublishedByAuthor(
            String authorId, int limit, String cursor, String viewerId) {
        if (limit <= 0) {
            limit = 20;
        }
        limit = Math.min(limit, MAX_PUBLIC_LIST_LIMIT);
        // One extra row probes "is there a next page" — a page that ends exactly on a full
        // window is otherwise indistinguishable from an exhausted list.
        int probeLimit = limit + 1;
        List<Moment> moments;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null) {
                throw new FieldContractException("cursor", "分页游标无效");
            }
            moments = momentMapper.listByAuthorIdAfter(
                    authorId, Instant.ofEpochMilli(Long.parseLong(parts[1])), parts[2], probeLimit);
        } else {
            moments = momentMapper.listByAuthorId(authorId, probeLimit);
        }
        boolean hasMore = moments.size() > limit;
        List<Moment> page = hasMore ? moments.subList(0, limit) : moments;
        // The cursor is the last row actually returned, never the probe row.
        String nextCursor = hasMore
                ? CursorCodec.encode(
                        OBJECT_TYPE,
                        page.get(page.size() - 1).getCreatedAt(),
                        page.get(page.size() - 1).getId())
                : null;
        return PageResultView.<MomentView>builder()
                .items(withViewerMetrics(page, viewerId))
                .nextCursor(nextCursor)
                .build();
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
        Map<String, MomentRevision> revisions = latestRevisions(moments);
        Map<String, CommunityProfile> profiles = authorProfiles(moments);
        return moments.stream()
                .map(moment -> toListedView(
                        moment,
                        revisions.get(moment.getId()),
                        profiles.get(moment.getAuthorId()),
                        likeCounts.getOrDefault(moment.getId(), 0L),
                        commentCounts.getOrDefault(moment.getId(), 0L),
                        // A guest must stay null, not Boolean.FALSE. Boxing contains() is only safe
                        // after the viewer check; otherwise the feed renders an un-liked button.
                        viewerId == null ? null : likedIds.contains(moment.getId())))
                .toList();
    }

    public List<MomentView> listMine(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<Moment> moments = momentMapper.listByAuthorId(user.getId(), limit);
        if (moments.isEmpty()) {
            return List.of();
        }
        Map<String, MomentRevision> revisions = latestRevisions(moments);
        Map<String, CommunityProfile> profiles = authorProfiles(moments);
        return moments.stream()
                .map(moment -> toListedView(
                        moment,
                        revisions.get(moment.getId()),
                        profiles.get(moment.getAuthorId()),
                        null,
                        null,
                        null))
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

    /**
     * 作者编辑。先锁动态行，锁内仍须是 PUBLISHED。
     * 正文写入新修订，动态行只更新 {@code updated_at}，不把内存里的 status 写回去。
     */
    @Transactional
    public MomentView update(CommunityUser user, String momentId, Map<String, String> body) {
        List<Moment> locked = momentMapper.selectList(new LambdaQueryWrapper<Moment>()
                .eq(Moment::getId, momentId)
                .last("FOR UPDATE"));
        if (locked.isEmpty() || !user.getId().equals(locked.get(0).getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Moment moment = locked.get(0);
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
        int written = momentMapper.update(null, new LambdaUpdateWrapper<Moment>()
                .eq(Moment::getId, momentId)
                .eq(Moment::getStatus, "PUBLISHED")
                .set(Moment::getUpdatedAt, now));
        if (written == 0) {
            throw new ContractException(ErrorCode.CONFLICT, "只能编辑已发布的动态");
        }
        moment.setUpdatedAt(now);
        publishMomentChanged(moment);
        return toView(moment);
    }

    /**
     * 作者回收。状态、Outbox 和索引刷新在同一事务里。
     * {@code moment.status} 只有一列，不能同时记下回收和治理隐藏，所以隐藏中的动态拒绝改写。
     */
    @Transactional
    public MomentView trash(CommunityUser user, String momentId) {
        List<Moment> locked = momentMapper.selectList(new LambdaQueryWrapper<Moment>()
                .eq(Moment::getId, momentId)
                .last("FOR UPDATE"));
        if (locked.isEmpty() || !user.getId().equals(locked.get(0).getAuthorId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Moment moment = locked.get(0);
        if ("HIDDEN".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "治理隐藏中的动态不能改成回收");
        }
        if ("PUBLISHED".equals(moment.getStatus())) {
            Instant now = Instant.now();
            momentMapper.update(null, new LambdaUpdateWrapper<Moment>()
                    .eq(Moment::getId, momentId)
                    .eq(Moment::getStatus, "PUBLISHED")
                    .set(Moment::getStatus, "TRASHED")
                    .set(Moment::getUpdatedAt, now));
            moment.setStatus("TRASHED");
            moment.setUpdatedAt(now);
            publishMomentChanged(moment);
        } else if (!"TRASHED".equals(moment.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "当前状态不能回收");
        }
        searchIndexService.refresh(SearchIndexService.MOMENT, momentId);
        return toView(moment);
    }

    /**
     * Admin recycle / restore.
     *
     * <p>The moment row is locked before the status is read. Two overlapping calls otherwise
     * keep their own repeatable-read snapshots: a repeat that does not update the row can
     * refresh the search document from the status it saw at the start, and put a trashed
     * moment back into search after the other transaction has committed. {@code FOR UPDATE}
     * makes the later call wait, then read the committed row.
     *
     * <p>The status write, the {@code MomentChanged} outbox insert, and
     * {@link SearchIndexService#refresh} run in this transaction. Refresh is invoked even
     * when the status is already the requested one, so a repeated click repairs a stale
     * index row. An exception from refresh is not caught: it rolls the status and the
     * event back with the index write.
     *
     * @return {@code false} when no moment has this id
     */
    @Transactional
    public boolean applyOperationalStatus(String momentId, String status) {
        List<Moment> locked = momentMapper.selectList(new LambdaQueryWrapper<Moment>()
                .eq(Moment::getId, momentId)
                .last("FOR UPDATE"));
        if (locked.isEmpty()) {
            return false;
        }
        Moment moment = locked.get(0);
        if (!status.equals(moment.getStatus())) {
            moment.setStatus(status);
            moment.setUpdatedAt(Instant.now());
            momentMapper.updateById(moment);
            publishMomentChanged(moment);
        }
        searchIndexService.refresh(SearchIndexService.MOMENT, momentId);
        return true;
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
        return toListedView(
                moment,
                momentRevisionMapper.findLatestByMomentId(moment.getId()),
                profileMapper.findByUserId(moment.getAuthorId()),
                null,
                null,
                null);
    }

    private Map<String, MomentRevision> latestRevisions(List<Moment> moments) {
        List<String> momentIds = new ArrayList<>();
        for (Moment moment : moments) {
            if (moment.getId() != null && !momentIds.contains(moment.getId())) {
                momentIds.add(moment.getId());
            }
        }
        if (momentIds.isEmpty()) {
            return Map.of();
        }
        Map<String, MomentRevision> revisions = new HashMap<>();
        for (MomentRevision revision : momentRevisionMapper.listLatestByMomentIds(momentIds)) {
            revisions.putIfAbsent(revision.getMomentId(), revision);
        }
        return revisions;
    }

    private Map<String, CommunityProfile> authorProfiles(List<Moment> moments) {
        List<String> authorIds = new ArrayList<>();
        for (Moment moment : moments) {
            if (moment.getAuthorId() != null && !authorIds.contains(moment.getAuthorId())) {
                authorIds.add(moment.getAuthorId());
            }
        }
        if (authorIds.isEmpty()) {
            return Map.of();
        }
        Map<String, CommunityProfile> profiles = new HashMap<>();
        for (CommunityProfile profile : profileMapper.findByUserIds(authorIds)) {
            profiles.putIfAbsent(profile.getUserId(), profile);
        }
        return profiles;
    }

    private MomentView toListedView(
            Moment moment,
            MomentRevision revision,
            CommunityProfile profile,
            Long likeCount,
            Long commentCount,
            Boolean liked) {
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
