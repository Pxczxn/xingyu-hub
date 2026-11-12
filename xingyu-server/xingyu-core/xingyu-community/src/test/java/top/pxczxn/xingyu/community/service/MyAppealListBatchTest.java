package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.CaseMeasureRow;
import top.pxczxn.xingyu.community.entity.Appeal;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.mapper.AppealMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationCaseMapper;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReportMapper;

import java.io.Serializable;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MyAppealListBatchTest {

    private final ReportMapper reports = mock(ReportMapper.class);
    private final ModerationCaseMapper cases = mock(ModerationCaseMapper.class);
    private final ModerationMeasureMapper measures = mock(ModerationMeasureMapper.class);
    private final AppealMapper appeals = mock(AppealMapper.class);
    private final CommentMapper comments = mock(CommentMapper.class);
    private final MomentRevisionMapper momentRevisions = mock(MomentRevisionMapper.class);
    private final PublishedRevisionMapper published = mock(PublishedRevisionMapper.class);
    private final FormalRevisionMapper formals = mock(FormalRevisionMapper.class);
    private final ModerationService service = new ModerationService(
            reports, null, cases, null, measures, appeals, null, null,
            comments, momentRevisions, published, formals, null, null);

    @Test
    void listingMineLoadsCasesReportsDescriptionsAndMeasuresOnce() {
        when(appeals.listByAppellantId("me", 20)).thenReturn(List.of(
                appeal("ap1", "case-1"),
                appeal("ap2", "case-missing"),
                appeal("ap3", "case-3"),
                appeal("ap4", "case-4")));
        when(cases.selectBatchIds(List.of("case-1", "case-missing", "case-3", "case-4")))
                .thenReturn(List.of(
                        moderationCase("case-1", "r1"),
                        moderationCase("case-3", "r-gone"),
                        moderationCase("case-4", "r4")));
        when(reports.selectBatchIds(List.of("r1", "r-gone", "r4"))).thenReturn(List.of(
                report("r1", "ARTICLE", "a1"),
                report("r4", "MOMENT", "m1")));
        when(published.listByArticleIds(List.of("a1")))
                .thenReturn(List.of(publishedRevision("a1", "rev-pub")));
        when(formals.listByIds(List.of("rev-pub")))
                .thenReturn(List.of(formal("rev-pub", "Essay", "pub")));
        when(momentRevisions.listLatestByMomentIds(List.of("m1")))
                .thenReturn(List.of(momentRevision("m1", "hello moment")));
        when(measures.listLatestByCaseIds(List.of("case-1", "case-missing", "case-3", "case-4")))
                .thenReturn(List.of(
                        new CaseMeasureRow("case-1", "HIDE"),
                        new CaseMeasureRow("case-3", "LIMIT")));

        var listed = service.listMyAppeals(user("me"), 0);

        assertThat(listed).extracting("id").containsExactly("ap1", "ap2", "ap3", "ap4");
        assertThat(listed).extracting("targetTitle").containsExactly("Essay", null, null, null);
        assertThat(listed).extracting("targetSummary").containsExactly("pub", null, null, "hello moment");
        assertThat(listed).extracting("measureType").containsExactly("HIDE", null, "LIMIT", null);
        verify(cases, never()).selectById(any(Serializable.class));
        verify(reports, never()).selectById(any(Serializable.class));
        verify(measures, never()).findLatestByCaseId(any());
        verify(published, never()).findByArticleId(any());
        verify(momentRevisions, never()).findLatestByMomentId(any());
        verify(comments, never()).selectBatchIds(any());
    }

    @Test
    void emptyListDoesNotQueryAndOwnerDetailStaysSingleRow() {
        when(appeals.listByAppellantId("me", 20)).thenReturn(List.of());

        assertThat(service.listMyAppeals(user("me"), 20)).isEmpty();

        verify(cases, never()).selectBatchIds(any());
        verify(reports, never()).selectBatchIds(any());
        verify(measures, never()).listLatestByCaseIds(any());
        verify(published, never()).listByArticleIds(any());

        when(appeals.selectById("ap1")).thenReturn(appeal("ap1", "case-1"));
        when(cases.selectById("case-1")).thenReturn(moderationCase("case-1", "r1"));
        when(reports.selectById("r1")).thenReturn(report("r1", "ARTICLE", "a1"));
        when(published.findByArticleId("a1")).thenReturn(publishedRevision("a1", "rev-pub"));
        when(formals.findById("rev-pub")).thenReturn(formal("rev-pub", "Essay", "pub"));
        ModerationMeasure measure = new ModerationMeasure();
        measure.setMeasureType("HIDE");
        when(measures.findLatestByCaseId("case-1")).thenReturn(measure);

        var detail = service.getMyAppeal(user("me"), "ap1");

        assertThat(detail.getTargetTitle()).isEqualTo("Essay");
        assertThat(detail.getMeasureType()).isEqualTo("HIDE");
        verify(cases, never()).selectBatchIds(any());
        verify(measures, never()).listLatestByCaseIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Appeal appeal(String id, String caseId) {
        Appeal appeal = new Appeal();
        appeal.setId(id);
        appeal.setCaseId(caseId);
        appeal.setAppellantId("me");
        appeal.setStatus("PENDING");
        appeal.setBody("please review");
        return appeal;
    }

    private static ModerationCase moderationCase(String id, String reportId) {
        ModerationCase moderationCase = new ModerationCase();
        moderationCase.setId(id);
        moderationCase.setReportId(reportId);
        return moderationCase;
    }

    private static Report report(String id, String objectType, String objectId) {
        Report report = new Report();
        report.setId(id);
        report.setObjectType(objectType);
        report.setObjectId(objectId);
        return report;
    }

    private static PublishedRevision publishedRevision(String articleId, String formalRevisionId) {
        PublishedRevision published = new PublishedRevision();
        published.setArticleId(articleId);
        published.setFormalRevisionId(formalRevisionId);
        return published;
    }

    private static FormalRevision formal(String id, String title, String summary) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
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
}
