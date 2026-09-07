package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.ReviewQueueItemView;
import top.pxczxn.xingyu.community.dto.ReviewSubmissionDetailView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ReviewDecision;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ReviewSubmissionMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ArticleService articleService;
    private final PublicationService publicationService;
    private final ArticleMapper articleMapper;
    private final ReviewSubmissionMapper submissionMapper;
    private final ReviewDecisionMapper decisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final CommunityEventSupport eventSupport;
    private final CommunityProfileMapper profileMapper;

    @Transactional
    public ReviewSubmission submitForReview(CommunityUser user, String articleId) {
        Article article = articleService.requireOwnedArticle(user, articleId);
        if (ArticleStateSupport.isUnderReview(article)) {
            throw new ContractException(ErrorCode.CONFLICT, "文章已在审核中");
        }

        WorkingDraft draft = articleService.requireDraft(articleId);
        validateDraftForSubmission(draft);

        Instant now = Instant.now();
        int nextRevision = formalRevisionMapper.maxRevisionNumber(articleId) + 1;

        FormalRevision revision = new FormalRevision();
        revision.setId(TokenSupport.newId());
        revision.setArticleId(articleId);
        revision.setRevisionNumber(nextRevision);
        revision.setTitle(draft.getTitle());
        revision.setSummary(draft.getSummary());
        revision.setBodyMode(draft.getBodyMode());
        revision.setBody(draft.getBody());
        revision.setSlug(draft.getSlug());
        revision.setVisibility(draft.getVisibility());
        revision.setSourceDraftLockVersion(draft.getLockVersion() == null ? 0L : draft.getLockVersion());
        revision.setFrozenAt(now);
        revision.setCreatedAt(now);
        formalRevisionMapper.insert(revision);

        ReviewSubmission submission = new ReviewSubmission();
        submission.setId(TokenSupport.newId());
        submission.setArticleId(articleId);
        submission.setFormalRevisionId(revision.getId());
        submission.setSubmittedBy(user.getId());
        submission.setStatus("PENDING");
        submission.setSubmittedAt(now);
        submissionMapper.insert(submission);

        article.setStatus(ArticleStateSupport.EDITORIAL_IN_REVIEW);
        article.setUpdatedAt(now);
        articleMapper.updateById(article);

        eventSupport.publishArticleEvent(
                "revision-submitted:" + submission.getId(),
                CommunityEventSupport.REVISION_SUBMITTED,
                articleId);

        return submission;
    }

    public List<ReviewQueueItemView> listPendingQueue() {
        return submissionMapper.listPending().stream()
                .map(submission -> {
                    FormalRevision revision = formalRevisionMapper.selectById(submission.getFormalRevisionId());
                    String authorId = submission.getSubmittedBy();
                    CommunityProfile profile = authorId == null ? null : profileMapper.findByUserId(authorId);
                    String displayName = profile == null ? null : profile.getDisplayName();
                    String username = profile == null ? null : profile.getUsername();
                    return ReviewQueueItemView.builder()
                            .submissionId(submission.getId())
                            .articleId(submission.getArticleId())
                            .formalRevisionId(submission.getFormalRevisionId())
                            .title(revision == null ? null : revision.getTitle())
                            .submittedBy(authorId)
                            .authorId(authorId)
                            .authorDisplayName(displayName)
                            .authorUsername(username)
                            .authorLabel(formatAuthorLabel(displayName, username))
                            .summary(revision == null ? null : revision.getSummary())
                            .body(revision == null ? null : revision.getBody())
                            .submittedAt(submission.getSubmittedAt())
                            .build();
                })
                .toList();
    }

    private static String formatAuthorLabel(String displayName, String username) {
        String nickname = displayName == null ? null : displayName.trim();
        String handle = username == null ? null : username.trim();
        if (nickname != null && !nickname.isEmpty() && handle != null && !handle.isEmpty()) {
            return nickname + " | " + handle;
        }
        if (nickname != null && !nickname.isEmpty()) {
            return nickname + " | " + nickname;
        }
        if (handle != null && !handle.isEmpty()) {
            return handle + " | " + handle;
        }
        return null;
    }

    public List<ReviewSubmissionDetailView> listMySubmissions(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return submissionMapper.listBySubmittedBy(user.getId(), limit).stream()
                .map(submission -> toDetailView(submission))
                .toList();
    }

    public ReviewSubmissionDetailView getSubmissionForOwner(CommunityUser user, String submissionId) {
        ReviewSubmission submission = submissionMapper.selectById(submissionId);
        if (submission == null || !user.getId().equals(submission.getSubmittedBy())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toDetailView(submission);
    }

    @Transactional
    public ReviewSubmission withdraw(CommunityUser user, String submissionId) {
        ReviewSubmission submission = submissionMapper.selectById(submissionId);
        if (submission == null || !user.getId().equals(submission.getSubmittedBy())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!"PENDING".equals(submission.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "只能撤回待审核的提交");
        }

        Instant now = Instant.now();
        submission.setStatus("WITHDRAWN");
        submissionMapper.updateById(submission);

        Article article = articleMapper.selectById(submission.getArticleId());
        if (article != null && ArticleStateSupport.isUnderReview(article)) {
            article.setStatus(ArticleStateSupport.EDITORIAL_DRAFT);
            article.setUpdatedAt(now);
            articleMapper.updateById(article);
        }

        eventSupport.publishArticleEvent(
                "revision-withdrawn:" + submissionId,
                CommunityEventSupport.REVISION_SUBMITTED,
                submission.getArticleId());

        return submission;
    }

    @Transactional
    public ReviewDecision decide(String submissionId, String adminUserId, String decision, String comment) {
        ReviewSubmission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!"PENDING".equals(submission.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "审核提交已处理");
        }

        String normalizedDecision = normalizeDecision(decision);
        Instant now = Instant.now();

        ReviewDecision reviewDecision = new ReviewDecision();
        reviewDecision.setId(TokenSupport.newId());
        reviewDecision.setSubmissionId(submissionId);
        reviewDecision.setDecision(normalizedDecision);
        reviewDecision.setDecidedBy(adminUserId);
        reviewDecision.setComment(comment);
        reviewDecision.setDecidedAt(now);
        decisionMapper.insert(reviewDecision);

        submission.setStatus(normalizedDecision);
        submissionMapper.updateById(submission);

        Article article = articleMapper.selectById(submission.getArticleId());
        if (article != null) {
            if ("APPROVED".equals(normalizedDecision)) {
                publicationService.publishApprovedRevision(submission);
            } else {
                article.setStatus(ArticleStateSupport.EDITORIAL_DRAFT);
                article.setUpdatedAt(now);
                articleMapper.updateById(article);
            }
        }

        eventSupport.publishArticleEvent(
                "review-decision:" + submissionId,
                CommunityEventSupport.REVIEW_DECISION_RECORDED,
                submission.getArticleId());

        return reviewDecision;
    }

    private void validateDraftForSubmission(WorkingDraft draft) {
        if (draft.getTitle() == null || draft.getTitle().isBlank()) {
            throw new FieldContractException("title", "提交审核前必须填写标题");
        }
        if (draft.getBodyMode() == null || draft.getBodyMode().isBlank()) {
            throw new FieldContractException("bodyMode", "提交审核前必须选择正文模式");
        }
        if (draft.getBody() == null || draft.getBody().isBlank()) {
            throw new FieldContractException("body", "提交审核前必须填写正文");
        }
        if (draft.getVisibility() == null || draft.getVisibility().isBlank()) {
            throw new FieldContractException("visibility", "提交审核前必须设置可见性");
        }
    }

    private static String normalizeDecision(String decision) {
        if (decision == null || decision.isBlank()) {
            throw new FieldContractException("decision", "审核决定不能为空");
        }
        String normalized = decision.trim().toUpperCase(Locale.ROOT);
        if (!"APPROVED".equals(normalized)
                && !"REJECTED".equals(normalized)
                && !"RETURNED".equals(normalized)) {
            throw new FieldContractException("decision", "审核决定无效");
        }
        return normalized;
    }

    private ReviewSubmissionDetailView toDetailView(ReviewSubmission submission) {
        FormalRevision revision = formalRevisionMapper.selectById(submission.getFormalRevisionId());
        ReviewDecision decision = decisionMapper.findBySubmissionId(submission.getId());
        return ReviewSubmissionDetailView.builder()
                .id(submission.getId())
                .articleId(submission.getArticleId())
                .title(revision == null ? null : revision.getTitle())
                .status(submission.getStatus())
                .submittedAt(submission.getSubmittedAt())
                .decision(decision == null ? null : decision.getDecision())
                .decisionComment(decision == null ? null : decision.getComment())
                .build();
    }
}
