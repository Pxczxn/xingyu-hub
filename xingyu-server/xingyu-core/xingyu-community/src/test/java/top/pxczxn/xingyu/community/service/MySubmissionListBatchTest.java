package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ReviewDecision;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewSubmissionMapper;

import java.io.Serializable;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MySubmissionListBatchTest {

    private final ReviewSubmissionMapper submissions = mock(ReviewSubmissionMapper.class);
    private final ReviewDecisionMapper decisions = mock(ReviewDecisionMapper.class);
    private final FormalRevisionMapper revisions = mock(FormalRevisionMapper.class);
    private final ReviewService service = new ReviewService(
            null, null, null, submissions, decisions, revisions, null, null, null, null);

    @Test
    void listingMineLoadsRevisionsAndDecisionsOnceAndKeepsOrder() {
        when(submissions.listBySubmittedBy("me", 20)).thenReturn(List.of(
                submission("sub-1", "art-1", "rev-1", "APPROVED"),
                submission("sub-2", "art-2", "rev-2", "PENDING")));
        when(revisions.listByIds(List.of("rev-1", "rev-2"))).thenReturn(List.of(
                revision("rev-2", "Draft", null),
                revision("rev-1", "Essay", "cover.png")));
        when(decisions.listBySubmissionIds(List.of("sub-1", "sub-2"))).thenReturn(List.of(
                decision("sub-1", "APPROVED", "ok")));

        var listed = service.listMySubmissions(user("me"), 0);

        assertThat(listed).extracting("id").containsExactly("sub-1", "sub-2");
        assertThat(listed).extracting("title").containsExactly("Essay", "Draft");
        assertThat(listed).extracting("coverUrl").containsExactly("cover.png", null);
        assertThat(listed).extracting("decision").containsExactly("APPROVED", null);
        assertThat(listed).extracting("decisionComment").containsExactly("ok", null);
        verify(revisions, never()).selectById(any(Serializable.class));
        verify(revisions, never()).findById(any());
        verify(decisions, never()).findBySubmissionId(any());
    }

    @Test
    void emptyListDoesNotQueryRevisionsOrDecisionsAndOwnerDetailStaysSingleRow() {
        when(submissions.listBySubmittedBy("me", 20)).thenReturn(List.of());

        assertThat(service.listMySubmissions(user("me"), 20)).isEmpty();

        verify(revisions, never()).listByIds(any());
        verify(decisions, never()).listBySubmissionIds(any());
        verify(revisions, never()).selectById(any(Serializable.class));
        verify(decisions, never()).findBySubmissionId(any());

        when(submissions.selectById("sub-1")).thenReturn(submission("sub-1", "art-1", "rev-1", "APPROVED"));
        when(revisions.selectById("rev-1")).thenReturn(revision("rev-1", "Essay", "cover.png"));
        when(decisions.findBySubmissionId("sub-1")).thenReturn(decision("sub-1", "APPROVED", "ok"));

        var detail = service.getSubmissionForOwner(user("me"), "sub-1");

        assertThat(detail.getTitle()).isEqualTo("Essay");
        assertThat(detail.getDecisionComment()).isEqualTo("ok");
        verify(revisions, never()).listByIds(any());
        verify(decisions, never()).listBySubmissionIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static ReviewSubmission submission(String id, String articleId, String revisionId, String status) {
        ReviewSubmission submission = new ReviewSubmission();
        submission.setId(id);
        submission.setArticleId(articleId);
        submission.setFormalRevisionId(revisionId);
        submission.setSubmittedBy("me");
        submission.setStatus(status);
        return submission;
    }

    private static FormalRevision revision(String id, String title, String coverUrl) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
        revision.setTitle(title);
        revision.setCoverUrl(coverUrl);
        return revision;
    }

    private static ReviewDecision decision(String submissionId, String decision, String comment) {
        ReviewDecision row = new ReviewDecision();
        row.setSubmissionId(submissionId);
        row.setDecision(decision);
        row.setComment(comment);
        return row;
    }
}
