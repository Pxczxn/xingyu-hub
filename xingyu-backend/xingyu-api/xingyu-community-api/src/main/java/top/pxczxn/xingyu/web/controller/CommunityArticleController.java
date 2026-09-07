package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ArticlePublicView;
import top.pxczxn.xingyu.community.dto.ArticleRevisionView;
import top.pxczxn.xingyu.community.dto.ArticleSummaryView;
import top.pxczxn.xingyu.community.dto.TrashItemView;
import top.pxczxn.xingyu.community.dto.WorkingDraftView;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.service.ArticleService;
import top.pxczxn.xingyu.community.service.ReviewService;
import top.pxczxn.xingyu.community.service.TrashService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class CommunityArticleController {

    private final ArticleService articleService;
    private final ReviewService reviewService;
    private final TrashService trashService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping("/me/articles")
    public List<ArticleSummaryView> listArticles() {
        return articleService.listForOwner(CommunityAuthContext.requireUser());
    }

    @PostMapping("/me/articles")
    public WorkingDraftView createArticle() {
        return articleService.createShell(CommunityAuthContext.requireUser());
    }

    @GetMapping("/me/articles/{articleId}")
    public WorkingDraftView getDraft(@PathVariable String articleId) {
        return articleService.getDraft(CommunityAuthContext.requireUser(), articleId);
    }

    @GetMapping("/me/articles/{articleId}/revisions")
    public List<ArticleRevisionView> listRevisions(@PathVariable String articleId) {
        return articleService.listRevisions(CommunityAuthContext.requireUser(), articleId);
    }

    @PutMapping("/me/articles/{articleId}/draft")
    public WorkingDraftView saveDraft(
            @PathVariable String articleId,
            @RequestBody Map<String, Object> body) {
        return articleService.saveDraft(CommunityAuthContext.requireUser(), articleId, body);
    }

    @PostMapping("/me/articles/{articleId}/revisions/{revisionId}/restore")
    public WorkingDraftView restoreRevision(
            @PathVariable String articleId,
            @PathVariable String revisionId) {
        return articleService.restoreRevision(
                CommunityAuthContext.requireUser(), articleId, revisionId);
    }

    @PostMapping("/me/articles/{articleId}/submit")
    public Map<String, String> submit(@PathVariable String articleId) {
        ReviewSubmission submission = reviewService.submitForReview(
                CommunityAuthContext.requireUser(), articleId);
        return Map.of("submissionId", submission.getId());
    }

    @PostMapping("/me/articles/{articleId}/trash")
    public TrashItemView trash(@PathVariable String articleId) {
        return trashService.trashArticle(CommunityAuthContext.requireUser(), articleId);
    }

    @PostMapping("/me/articles/{articleId}/schedule")
    public WorkingDraftView schedulePublish(
            @PathVariable String articleId,
            @RequestBody Map<String, Object> body) {
        return articleService.schedulePublish(CommunityAuthContext.requireUser(), articleId, body);
    }

    @PostMapping("/me/articles/{articleId}/cancel-schedule")
    public WorkingDraftView cancelSchedule(@PathVariable String articleId) {
        return articleService.cancelSchedule(CommunityAuthContext.requireUser(), articleId);
    }

    @PostMapping("/me/articles/{articleId}/restore")
    public ResponseEntity<Void> restore(@PathVariable String articleId) {
        trashService.restoreArticle(CommunityAuthContext.requireUser(), articleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/trash")
    public List<TrashItemView> listTrash() {
        return trashService.listForOwner(CommunityAuthContext.requireUser());
    }

    @GetMapping("/articles/{articleId}")
    public ArticlePublicView readPublic(
            @PathVariable String articleId,
            @RequestHeader(value = "satoken", required = false) String token) {
        return articleService.getPublicArticle(articleId, resolveViewer(token));
    }

    private CommunityUser resolveViewer(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            CommunitySession session = accountService.requireActiveSession(token);
            return userMapper.selectById(session.getUserId());
        } catch (ContractException ex) {
            return null;
        }
    }
}
