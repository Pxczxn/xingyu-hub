package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.EventSubmission;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommunityEventMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.EventSubmissionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventSubmissionListBatchTest {

    private final CommunityEventMapper events = mock(CommunityEventMapper.class);
    private final EventSubmissionMapper submissions = mock(EventSubmissionMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final CommunityEventService service = new CommunityEventService(
            events, submissions, null, documents, profiles);

    @Test
    void listsKeepTitlesFromOneQueryPerObjectType() {
        when(submissions.listByAuthorId("me", 20)).thenReturn(List.of(
                submission("s1", "event-1", "me", "ARTICLE", "article-1"),
                submission("s2", "event-1", "me", "MOMENT", "moment-1")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("article-1")))
                .thenReturn(List.of(document("ARTICLE", "article-1", "文章标题")));
        when(documents.listByTypeAndIds("MOMENT", List.of("moment-1"))).thenReturn(List.of());
        CommunityEvent event = new CommunityEvent();
        event.setId("event-1");
        event.setStatus("ACTIVE");
        when(events.selectById("event-1")).thenReturn(event);
        when(submissions.listAcceptedByEventId("event-1", 50)).thenReturn(List.of(
                submission("s1", "event-1", "me", "ARTICLE", "article-1")));
        when(submissions.listByEventId("event-1", 100)).thenReturn(List.of(
                submission("s1", "event-1", "alice", "ARTICLE", "article-1"),
                submission("s3", "event-1", "ghost", "SERIES", "series-1")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("article-1")))
                .thenReturn(List.of(document("ARTICLE", "article-1", "文章标题")));
        when(documents.listByTypeAndIds("SERIES", List.of("series-1"))).thenReturn(List.of());
        when(profiles.findByUserIds(List.of("alice", "ghost"))).thenReturn(List.of(profile("alice", "Alice")));

        var mine = service.listMySubmissions(user("me"), 20);
        var accepted = service.listAcceptedSubmissions("event-1", 50);
        var admin = service.listSubmissionsForAdmin("event-1", 100);

        assertThat(mine).extracting("objectTitle").containsExactly("文章标题", null);
        assertThat(accepted).extracting("objectTitle").containsExactly("文章标题");
        assertThat(admin).extracting("objectTitle").containsExactly("文章标题", "series-1");
        assertThat(admin).extracting("authorUsername").containsExactly("Alice", "ghost");
        assertThat(admin).extracting("authorDisplayName").containsExactly("Alice", null);
        verify(documents).listByTypeAndIds("MOMENT", List.of("moment-1"));
        verify(documents).listByTypeAndIds("SERIES", List.of("series-1"));
        verify(documents, never()).findByObject(any(), any());
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptySubmissionListDoesNotQueryDocuments() {
        when(submissions.listByAuthorId("me", 20)).thenReturn(List.of());

        assertThat(service.listMySubmissions(user("me"), 20)).isEmpty();

        verify(documents, never()).listByTypeAndIds(any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static EventSubmission submission(
            String id, String eventId, String authorId, String objectType, String objectId) {
        EventSubmission submission = new EventSubmission();
        submission.setId(id);
        submission.setEventId(eventId);
        submission.setAuthorId(authorId);
        submission.setObjectType(objectType);
        submission.setObjectId(objectId);
        submission.setStatus("SUBMITTED");
        return submission;
    }

    private static SearchDocument document(String objectType, String objectId, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(objectType);
        document.setObjectId(objectId);
        document.setTitle(title);
        return document;
    }

    private static CommunityProfile profile(String userId, String username) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(username);
        return profile;
    }
}
