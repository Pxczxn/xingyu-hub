package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.CollaborationMemberMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SeriesChapterCountBatchTest {

    private final SeriesMapper series = mock(SeriesMapper.class);
    private final SeriesChapterMapper chapters = mock(SeriesChapterMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final CollaborationMemberMapper members = mock(CollaborationMemberMapper.class);
    private final SeriesService service = new SeriesService(
            null, series, null, chapters, null, profiles, null, null, null, members);

    @Test
    void ownerAndPublicListsCountChaptersOnce() {
        when(series.listByOwnerId("me")).thenReturn(List.of(series("owned", "me"), series("shared", "me")));
        when(members.listOwnerIdsByMemberId("me")).thenReturn(List.of());
        when(chapters.countBySeriesIds(List.of("owned", "shared")))
                .thenReturn(List.of(new ObjectCountRow("owned", 3)));
        when(series.listActive(20)).thenReturn(List.of(series("public", "author"), series("hidden", "missing")));
        when(profiles.findByUserIds(Set.of("author", "missing"))).thenReturn(List.of(profile("author")));
        when(chapters.countBySeriesIds(List.of("public"))).thenReturn(List.of(new ObjectCountRow("public", 2)));

        var mine = service.listForOwner(user("me"));
        var published = service.listPublic(20);

        assertThat(mine).extracting("chapterCount").containsExactly(3, 0);
        assertThat(published).extracting("id").containsExactly("public");
        assertThat(published).extracting("chapterCount").containsExactly(2);
        verify(chapters).countBySeriesIds(List.of("owned", "shared"));
        verify(chapters).countBySeriesIds(List.of("public"));
        verify(chapters, never()).countBySeriesId(any());
    }

    @Test
    void emptyOwnerListDoesNotCount() {
        when(series.listByOwnerId("me")).thenReturn(List.of());
        when(members.listOwnerIdsByMemberId("me")).thenReturn(List.of());

        assertThat(service.listForOwner(user("me"))).isEmpty();

        verify(chapters, never()).countBySeriesIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Series series(String id, String ownerId) {
        Series series = new Series();
        series.setId(id);
        series.setOwnerId(ownerId);
        series.setTitle(id);
        series.setSlug(id);
        series.setStatus("ACTIVE");
        return series;
    }

    private static CommunityProfile profile(String userId) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(userId);
        profile.setDisplayName(userId);
        return profile;
    }
}
