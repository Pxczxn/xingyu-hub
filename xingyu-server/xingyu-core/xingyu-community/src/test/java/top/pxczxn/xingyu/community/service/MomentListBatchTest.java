package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MomentListBatchTest {

    private final MomentMapper moments = mock(MomentMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final MomentRevisionMapper revisions = mock(MomentRevisionMapper.class);
    private final EngagementMetricsService metrics = mock(EngagementMetricsService.class);
    private final MomentService service = new MomentService(
            moments, profiles, revisions, null, null, metrics);

    @Test
    void publishedAndMineLoadBodiesAndAuthorsOnce() {
        when(moments.listPublished(20)).thenReturn(List.of(moment("m1", "author"), moment("m2", "gone")));
        when(revisions.listLatestByMomentIds(List.of("m1", "m2"))).thenReturn(List.of(revision("m1", "第一条")));
        when(profiles.findByUserIds(List.of("author", "gone"))).thenReturn(List.of(profile("author", "甲", "作者")));
        when(metrics.likeCounts(eq("MOMENT"), anyList())).thenReturn(Map.of("m1", 3L));
        when(metrics.commentCounts(eq("MOMENT"), anyList())).thenReturn(Map.of());
        when(moments.listByAuthorId("me", 20)).thenReturn(List.of(moment("m3", "me")));
        when(revisions.listLatestByMomentIds(List.of("m3"))).thenReturn(List.of(revision("m3", "我的")));
        when(profiles.findByUserIds(List.of("me"))).thenReturn(List.of(profile("me", "我", "自己")));

        var published = service.listPublished(0);
        var mine = service.listMine(user("me"), 0);

        assertThat(published).extracting("body").containsExactly("第一条", null);
        assertThat(published).extracting("authorUsername").containsExactly("甲", null);
        assertThat(published).extracting("authorDisplayName").containsExactly("作者", null);
        assertThat(published).extracting("likeCount").containsExactly(3L, 0L);
        assertThat(published).extracting("liked").containsExactly(null, null);
        assertThat(mine).extracting("body").containsExactly("我的");
        assertThat(mine.get(0).getLikeCount()).isNull();
        verify(revisions, never()).findLatestByMomentId(any());
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyListsDoNotQueryRevisionsOrProfilesAndASingleMomentStillLooksUpOnce() {
        when(moments.listPublished(20)).thenReturn(List.of());
        when(moments.listByAuthorId("me", 20)).thenReturn(List.of());
        when(moments.selectById("m1")).thenReturn(moment("m1", "author"));
        when(revisions.findLatestByMomentId("m1")).thenReturn(revision("m1", "单条"));
        when(profiles.findByUserId("author")).thenReturn(profile("author", "甲", "作者"));

        assertThat(service.listPublished(20)).isEmpty();
        assertThat(service.listMine(user("me"), 20)).isEmpty();
        assertThat(service.getById("m1").getBody()).isEqualTo("单条");

        verify(revisions, never()).listLatestByMomentIds(any());
        verify(profiles, never()).findByUserIds(any());
        verify(revisions).findLatestByMomentId("m1");
        verify(profiles).findByUserId("author");
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Moment moment(String id, String authorId) {
        Moment moment = new Moment();
        moment.setId(id);
        moment.setAuthorId(authorId);
        moment.setStatus("PUBLISHED");
        return moment;
    }

    private static MomentRevision revision(String momentId, String body) {
        MomentRevision revision = new MomentRevision();
        revision.setMomentId(momentId);
        revision.setBody(body);
        revision.setRevisionNumber(1);
        return revision;
    }

    private static CommunityProfile profile(String userId, String username, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }
}
