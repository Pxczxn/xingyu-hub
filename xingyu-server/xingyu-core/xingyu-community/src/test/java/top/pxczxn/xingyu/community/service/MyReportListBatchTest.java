package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationCaseMapper;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReportMapper;
import top.pxczxn.xingyu.community.mapper.ReportSupplementMapper;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MyReportListBatchTest {

    private final ReportMapper reports = mock(ReportMapper.class);
    private final ReportSupplementMapper supplements = mock(ReportSupplementMapper.class);
    private final ModerationCaseMapper cases = mock(ModerationCaseMapper.class);
    private final ModerationMeasureMapper measures = mock(ModerationMeasureMapper.class);
    private final CommentMapper comments = mock(CommentMapper.class);
    private final MomentRevisionMapper momentRevisions = mock(MomentRevisionMapper.class);
    private final PublishedRevisionMapper published = mock(PublishedRevisionMapper.class);
    private final FormalRevisionMapper formals = mock(FormalRevisionMapper.class);
    private final ModerationService service = new ModerationService(
            reports, supplements, cases, null, measures, null, null, null,
            comments, momentRevisions, published, formals, null, null);

    @Test
    void listingMineLoadsCasesAndTargetsOnceAndKeepsOrder() {
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        Instant caseUpdated = Instant.parse("2026-01-02T00:00:00Z");
        when(reports.listByReporterId("me")).thenReturn(List.of(
                report("r1", "ARTICLE", "a1", created),
                report("r2", "ARTICLE", "a2", created),
                report("r3", "MOMENT", "m1", created),
                report("r4", "COMMENT", "c1", created),
                report("r5", "ARTICLE", "gone", created)));
        when(cases.listByReportIds(List.of("r1", "r2", "r3", "r4", "r5")))
                .thenReturn(List.of(moderationCase("r1", caseUpdated)));
        when(published.listByArticleIds(List.of("a1", "a2", "gone")))
                .thenReturn(List.of(publishedRevision("a1", "rev-pub")));
        when(formals.listByIds(List.of("rev-pub")))
                .thenReturn(List.of(formal("rev-pub", "a1", "Essay", "pub")));
        when(formals.listLatestByArticleIds(List.of("a2", "gone")))
                .thenReturn(List.of(formal("rev-draft", "a2", "Draft", "wip")));
        when(momentRevisions.listLatestByMomentIds(List.of("m1")))
                .thenReturn(List.of(momentRevision("m1", "hello moment")));
        when(comments.selectBatchIds(List.of("c1")))
                .thenReturn(List.of(comment("c1", "hello comment")));

        var listed = service.listMyReports(user("me"));

        assertThat(listed).extracting("id").containsExactly("r1", "r2", "r3", "r4", "r5");
        assertThat(listed).extracting("targetTitle").containsExactly("Essay", "Draft", null, null, null);
        assertThat(listed).extracting("targetSummary")
                .containsExactly("pub", "wip", "hello moment", "hello comment", null);
        assertThat(listed).extracting("updatedAt")
                .containsExactly(caseUpdated, created, created, created, created);
        verify(cases, never()).findByReportId(any());
        verify(published, never()).findByArticleId(any());
        verify(formals, never()).findById(any());
        verify(formals, never()).listByArticleId(any());
        verify(momentRevisions, never()).findLatestByMomentId(any());
        verify(comments, never()).selectById(any(Serializable.class));
    }

    @Test
    void emptyListDoesNotQueryCasesOrTargetsAndOwnerDetailStaysSingleRow() {
        when(reports.listByReporterId("me")).thenReturn(List.of());

        assertThat(service.listMyReports(user("me"))).isEmpty();

        verify(cases, never()).listByReportIds(any());
        verify(published, never()).listByArticleIds(any());
        verify(formals, never()).listLatestByArticleIds(any());
        verify(momentRevisions, never()).listLatestByMomentIds(any());
        verify(comments, never()).selectBatchIds(any());

        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        Instant caseUpdated = Instant.parse("2026-01-02T00:00:00Z");
        when(reports.selectById("r1")).thenReturn(report("r1", "ARTICLE", "a1", created));
        when(cases.findByReportId("r1")).thenReturn(moderationCase("r1", caseUpdated));
        when(measures.findLatestByCaseId("case-r1")).thenReturn(null);
        when(supplements.listByReportId("r1")).thenReturn(List.of());
        when(published.findByArticleId("a1")).thenReturn(publishedRevision("a1", "rev-pub"));
        when(formals.findById("rev-pub")).thenReturn(formal("rev-pub", "a1", "Essay", "pub"));

        var detail = service.getMyReport(user("me"), "r1");

        assertThat(detail.getTargetTitle()).isEqualTo("Essay");
        assertThat(detail.getUpdatedAt()).isEqualTo(caseUpdated);
        verify(cases, never()).listByReportIds(any());
        verify(published, never()).listByArticleIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Report report(String id, String objectType, String objectId, Instant createdAt) {
        Report report = new Report();
        report.setId(id);
        report.setReporterId("me");
        report.setObjectType(objectType);
        report.setObjectId(objectId);
        report.setReason("SPAM");
        report.setStatus("SUBMITTED");
        report.setCreatedAt(createdAt);
        return report;
    }

    private static ModerationCase moderationCase(String reportId, Instant updatedAt) {
        ModerationCase moderationCase = new ModerationCase();
        moderationCase.setId("case-" + reportId);
        moderationCase.setReportId(reportId);
        moderationCase.setUpdatedAt(updatedAt);
        return moderationCase;
    }

    private static PublishedRevision publishedRevision(String articleId, String formalRevisionId) {
        PublishedRevision published = new PublishedRevision();
        published.setArticleId(articleId);
        published.setFormalRevisionId(formalRevisionId);
        return published;
    }

    private static FormalRevision formal(String id, String articleId, String title, String summary) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
        revision.setArticleId(articleId);
        revision.setTitle(title);
        revision.setSummary(summary);
        return revision;
    }

    private static MomentRevision momentRevision(String momentId, String body) {
        MomentRevision revision = new MomentRevision();
        revision.setMomentId(momentId);
        revision.setBody(body);
        return revision;
    }

    private static Comment comment(String id, String body) {
        Comment comment = new Comment();
        comment.setId(id);
        comment.setBody(body);
        return comment;
    }
}
