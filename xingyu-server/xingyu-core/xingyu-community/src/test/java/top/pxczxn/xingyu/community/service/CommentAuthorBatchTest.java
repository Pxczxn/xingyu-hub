package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommentAuthorBatchTest {

    private final CommentMapper comments = mock(CommentMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final ArticleService articles = mock(ArticleService.class);
    private final SocialService service = new SocialService(
            null, null, null, comments, null, profiles, null, null, null, null, articles, null);

    @Test
    void commentListsLoadAuthorsOnce() {
        when(comments.listVisibleByObject("ARTICLE", "article-1")).thenReturn(List.of(
                comment("c1", "author-a", "第一条"),
                comment("c2", "author-a", "第二条"),
                comment("c3", "gone", "第三条")));
        when(profiles.findByUserIds(List.of("author-a", "gone")))
                .thenReturn(List.of(profile("author-a", "甲")));
        when(comments.listPreviewByObject("ARTICLE", "article-1")).thenReturn(List.of(
                comment("c4", "author-b", "预览")));
        when(profiles.findByUserIds(List.of("author-b")))
                .thenReturn(List.of(profile("author-b", "乙")));

        var listed = service.listComments("ARTICLE", "article-1");
        var preview = service.listCommentPreview("ARTICLE", "article-1");

        assertThat(listed).extracting("authorUsername").containsExactly("甲", "甲", null);
        assertThat(listed).extracting("body").containsExactly("第一条", "第二条", "第三条");
        assertThat(preview).extracting("authorUsername").containsExactly("乙");
        verify(profiles, never()).findByUserId(any());
    }

    @Test
    void emptyListsSkipProfilesAndASingleCommentStillLooksUpOnce() {
        when(comments.listVisibleByObject("ARTICLE", "empty")).thenReturn(List.of());
        when(comments.listPreviewByObject("ARTICLE", "empty")).thenReturn(List.of());
        when(profiles.findByUserId("me")).thenReturn(profile("me", "我"));

        assertThat(service.listComments("ARTICLE", "empty")).isEmpty();
        assertThat(service.listCommentPreview("ARTICLE", "empty")).isEmpty();
        var created = service.createComment(user("me"), Map.of(
                "objectType", "ARTICLE",
                "objectId", "article-1",
                "body", "新评论"));

        assertThat(created.getAuthorUsername()).isEqualTo("我");
        verify(profiles, never()).findByUserIds(any());
        verify(profiles).findByUserId("me");
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Comment comment(String id, String authorId, String body) {
        Comment comment = new Comment();
        comment.setId(id);
        comment.setAuthorId(authorId);
        comment.setBody(body);
        return comment;
    }

    private static CommunityProfile profile(String userId, String username) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        return profile;
    }
}
