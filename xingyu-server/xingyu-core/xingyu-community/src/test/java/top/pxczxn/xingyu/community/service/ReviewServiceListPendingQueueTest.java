package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ReviewQueueItemView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewSubmissionMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewServiceListPendingQueueTest {

    private ReviewSubmissionMapper submissionMapper;
    private FormalRevisionMapper formalRevisionMapper;
    private CommunityProfileMapper profileMapper;
    private ReviewService service;

    @BeforeEach
    void setUp() {
        submissionMapper = mock(ReviewSubmissionMapper.class);
        formalRevisionMapper = mock(FormalRevisionMapper.class);
        profileMapper = mock(CommunityProfileMapper.class);
        service = new ReviewService(
                mock(ArticleService.class),
                mock(PublicationService.class),
                mock(ArticleMapper.class),
                submissionMapper,
                mock(ReviewDecisionMapper.class),
                formalRevisionMapper,
                mock(CommunityEventSupport.class),
                profileMapper,
                mock(WorkingDraftMapper.class),
                mock(CommunityUserMapper.class));
    }

    @Test
    void emptyQueueDoesNotLoadRevisionsOrProfiles() {
        when(submissionMapper.listPending()).thenReturn(List.of());
        assertEquals(List.of(), service.listPendingQueue());
        verify(formalRevisionMapper, never()).listByIds(any());
        verify(profileMapper, never()).findByUserIds(any());
        verify(formalRevisionMapper, never()).selectById(any());
        verify(profileMapper, never()).findByUserId(any());
    }

    @Test
    void pendingQueuePreservesOrderAndBatchesLookups() {
        Instant first = Instant.parse("2026-11-01T00:00:00Z");
        Instant second = Instant.parse("2026-11-02T00:00:00Z");
        when(submissionMapper.listPending()).thenReturn(List.of(
                submission("s1", "a1", "r1", "u1", first),
                submission("s2", "a2", "r2", "u1", second),
                submission("s3", "a3", "r3", null, second)));
        when(formalRevisionMapper.listByIds(List.of("r1", "r2", "r3"))).thenReturn(List.of(
                revision("r1", "标题一", "摘要一", "正文一"),
                revision("r2", "标题二", "摘要二", "正文二")));
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("u1");
        profile.setDisplayName("晨星");
        profile.setUsername("chen");
        when(profileMapper.findByUserIds(List.of("u1"))).thenReturn(List.of(profile));

        List<ReviewQueueItemView> items = service.listPendingQueue();

        assertEquals(3, items.size());
        assertEquals("s1", items.get(0).getSubmissionId());
        assertEquals("标题一", items.get(0).getTitle());
        assertEquals("晨星 | chen", items.get(0).getAuthorLabel());
        assertEquals("s2", items.get(1).getSubmissionId());
        assertEquals("晨星 | chen", items.get(1).getAuthorLabel());
        assertEquals("s3", items.get(2).getSubmissionId());
        assertNull(items.get(2).getTitle());
        assertNull(items.get(2).getAuthorLabel());
        verify(formalRevisionMapper).listByIds(List.of("r1", "r2", "r3"));
        verify(profileMapper).findByUserIds(List.of("u1"));
        verify(formalRevisionMapper, never()).selectById(any());
        verify(profileMapper, never()).findByUserId(any());
    }

    private static ReviewSubmission submission(String id, String articleId, String revisionId,
                                               String authorId, Instant submittedAt) {
        ReviewSubmission submission = new ReviewSubmission();
        submission.setId(id);
        submission.setArticleId(articleId);
        submission.setFormalRevisionId(revisionId);
        submission.setSubmittedBy(authorId);
        submission.setStatus("PENDING");
        submission.setSubmittedAt(submittedAt);
        return submission;
    }

    private static FormalRevision revision(String id, String title, String summary, String body) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
        revision.setTitle(title);
        revision.setSummary(summary);
        revision.setBody(body);
        return revision;
    }
}
