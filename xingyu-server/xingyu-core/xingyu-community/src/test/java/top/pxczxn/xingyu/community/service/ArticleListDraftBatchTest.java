package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CollaborationMemberMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArticleListDraftBatchTest {

    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final WorkingDraftMapper drafts = mock(WorkingDraftMapper.class);
    private final CollaborationMemberMapper members = mock(CollaborationMemberMapper.class);
    private final ArticleService service = new ArticleService(
            null, articles, drafts, null, null, null, null, null, null, null, null, null, members);

    @Test
    void listsOwnedAndCollaboratedTitlesFromOneDraftQuery() {
        Instant newer = Instant.parse("2026-10-30T12:00:00Z");
        Instant older = newer.minusSeconds(60);
        when(articles.listByOwnerId("me")).thenReturn(List.of(article("owned", "me", older)));
        when(members.listOwnerIdsByMemberId("me")).thenReturn(List.of("host"));
        when(articles.listByOwnerIds(List.of("host"))).thenReturn(List.of(article("shared", "host", newer)));
        when(drafts.listByArticleIds(List.of("shared", "owned"))).thenReturn(List.of(
                draft("owned", "我的稿"),
                draft("shared", "主人的稿")));

        var listed = service.listForOwner(user("me"));

        assertThat(listed).extracting("id").containsExactly("shared", "owned");
        assertThat(listed).extracting("title").containsExactly("主人的稿", "我的稿");
        assertThat(listed).extracting("collaborationRole").containsExactly("EDITOR", "OWNER");
        verify(drafts).listByArticleIds(List.of("shared", "owned"));
        verify(drafts, never()).findByArticleId(org.mockito.ArgumentMatchers.any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Article article(String id, String ownerId, Instant updatedAt) {
        Article article = new Article();
        article.setId(id);
        article.setOwnerId(ownerId);
        article.setUpdatedAt(updatedAt);
        article.setLifecycleStatus("ACTIVE");
        return article;
    }

    private static WorkingDraft draft(String articleId, String title) {
        WorkingDraft draft = new WorkingDraft();
        draft.setArticleId(articleId);
        draft.setTitle(title);
        return draft;
    }
}
