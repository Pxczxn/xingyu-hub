package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.TrashItemView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ContentTrash;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.ContentTrashMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TrashService {

    public static final String OBJECT_TYPE_ARTICLE = "ARTICLE";

    private final ArticleService articleService;
    private final ArticleMapper articleMapper;
    private final ContentTrashMapper trashMapper;
    private final WorkingDraftMapper draftMapper;

    public List<TrashItemView> listForOwner(CommunityUser user) {
        return trashMapper.listByOwnerId(user.getId()).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public TrashItemView trashArticle(CommunityUser user, String articleId) {
        Article article = articleService.requireOwnedArticle(user, articleId);
        if (ArticleStateSupport.isTrashed(article)) {
            throw new ContractException(ErrorCode.CONFLICT, "文章已在回收站");
        }
        if (ArticleStateSupport.isUnderReview(article)) {
            throw new ContractException(ErrorCode.CONFLICT, "审核中的文章不可移入回收站");
        }
        Instant now = Instant.now();
        ContentTrash trash = trashMapper.findByObject(OBJECT_TYPE_ARTICLE, articleId);
        if (trash == null) {
            trash = new ContentTrash();
            trash.setId(TokenSupport.newId());
            trash.setObjectType(OBJECT_TYPE_ARTICLE);
            trash.setObjectId(articleId);
            trash.setOwnerId(article.getOwnerId());
            trash.setTrashedAt(now);
            trashMapper.insert(trash);
        }
        article.setLifecycleStatus(ArticleStateSupport.LIFECYCLE_TRASHED);
        article.setUpdatedAt(now);
        articleMapper.updateById(article);
        return toView(trash);
    }

    @Transactional
    public void restoreArticle(CommunityUser user, String articleId) {
        articleService.requireOwnedArticle(user, articleId);
        ContentTrash trash = trashMapper.findByObject(OBJECT_TYPE_ARTICLE, articleId);
        if (trash == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "文章不在回收站");
        }
        if (!user.getId().equals(trash.getOwnerId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        trashMapper.deleteByObject(OBJECT_TYPE_ARTICLE, articleId);
        Article article = articleMapper.selectById(articleId);
        if (article != null) {
            article.setLifecycleStatus(ArticleStateSupport.LIFECYCLE_ACTIVE);
            if (article.getStatus() == null || article.getStatus().isBlank()) {
                article.setStatus(ArticleStateSupport.EDITORIAL_DRAFT);
            }
            article.setUpdatedAt(Instant.now());
            articleMapper.updateById(article);
        }
    }

    public boolean isTrashed(String objectType, String objectId) {
        return trashMapper.findByObject(objectType, objectId) != null;
    }

    private TrashItemView toView(ContentTrash trash) {
        String title = null;
        if (OBJECT_TYPE_ARTICLE.equals(trash.getObjectType())) {
            WorkingDraft draft = draftMapper.findByArticleId(trash.getObjectId());
            if (draft != null) {
                title = draft.getTitle();
            }
        }
        return TrashItemView.builder()
                .objectType(trash.getObjectType())
                .objectId(trash.getObjectId())
                .title(title)
                .trashedAt(trash.getTrashedAt())
                .build();
    }
}
