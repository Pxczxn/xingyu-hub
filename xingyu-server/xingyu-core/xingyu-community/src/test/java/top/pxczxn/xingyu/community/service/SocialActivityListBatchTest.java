package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ContentLike;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SocialActivityListBatchTest {

    private final CommentMapper comments = mock(CommentMapper.class);
    private final ContentLikeMapper likes = mock(ContentLikeMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final SocialService service = new SocialService(
            likes, null, null, comments, null, null, null, documents, null, null, null, null);

    @Test
    void commentsAndLikesLoadTitlesByObjectType() {
        when(comments.listByAuthorId("me", 20)).thenReturn(List.of(
                comment("c1", "ARTICLE", "article-1", "写得好"),
                comment("c2", "MOMENT", "moment-1", "同类型"),
                comment("c3", "ARTICLE", "missing", "找不到")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("article-1", "missing")))
                .thenReturn(List.of(document("ARTICLE", "article-1", "文章标题")));
        when(documents.listByTypeAndIds("MOMENT", List.of("moment-1")))
                .thenReturn(List.of(document("MOMENT", "moment-1", "片刻标题")));
        when(likes.listByUserId("me", 20)).thenReturn(List.of(
                like("SERIES", "series-1"),
                like("ARTICLE", "gone")));
        when(documents.listByTypeAndIds("SERIES", List.of("series-1")))
                .thenReturn(List.of(document("SERIES", "series-1", "系列标题")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("gone"))).thenReturn(List.of());

        var listedComments = service.listMyComments(user("me"), 0);
        var listedLikes = service.listMyLikes(user("me"), 0);

        assertThat(listedComments).extracting("objectTitle").containsExactly("文章标题", "片刻标题", "missing");
        assertThat(listedLikes).extracting("title").containsExactly("系列标题", "gone");
        verify(documents, never()).findByObject(any(), any());
    }

    @Test
    void emptyActivityDoesNotQueryDocuments() {
        when(comments.listByAuthorId("me", 20)).thenReturn(List.of());
        when(likes.listByUserId("me", 20)).thenReturn(List.of());

        assertThat(service.listMyComments(user("me"), 20)).isEmpty();
        assertThat(service.listMyLikes(user("me"), 20)).isEmpty();

        verify(documents, never()).listByTypeAndIds(any(), any());
        verify(documents, never()).findByObject(any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Comment comment(String id, String objectType, String objectId, String body) {
        Comment comment = new Comment();
        comment.setId(id);
        comment.setObjectType(objectType);
        comment.setObjectId(objectId);
        comment.setBody(body);
        return comment;
    }

    private static ContentLike like(String objectType, String objectId) {
        ContentLike like = new ContentLike();
        like.setObjectType(objectType);
        like.setObjectId(objectId);
        return like;
    }

    private static SearchDocument document(String objectType, String objectId, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(objectType);
        document.setObjectId(objectId);
        document.setTitle(title);
        return document;
    }
}
