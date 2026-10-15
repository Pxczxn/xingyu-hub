package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.*;
import top.pxczxn.xingyu.web.controller.CommunitySocialController;
import top.pxczxn.xingyu.web.interceptor.CommunityAuthInterceptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CommentPreviewTest {
    private final CommentMapper comments = mock(CommentMapper.class);
    private final ArticleService articles = mock(ArticleService.class);
    private final SeriesService series = mock(SeriesService.class);
    private final SocialService social = new SocialService(null, null, null, comments, null,
            mock(CommunityProfileMapper.class), null, null, null, null, articles, series);

    @AfterEach
    void clearContext() {
        CommunityAuthContext.clear();
    }

    @Test
    void previewReturnsVisibleCommentsForPublicArticle() {
        Comment comment = new Comment();
        comment.setId("c1");
        comment.setAuthorId("u1");
        comment.setBody("公开评论");
        when(comments.listPreviewByObject("ARTICLE", "a1")).thenReturn(List.of(comment));
        assertEquals("公开评论", social.listCommentPreview("ARTICLE", "a1").getFirst().getBody());
        verify(articles).getPublicArticle("a1", null);
        verify(comments, never()).listVisibleByObject(anyString(), anyString());
    }

    @Test
    void privateContentCannotExposeComments() {
        when(articles.getPublicArticle("private", null)).thenThrow(new ContractException(ErrorCode.NOT_FOUND));
        assertThrows(ContractException.class, () -> social.listCommentPreview("ARTICLE", "private"));
        verifyNoInteractions(comments);
    }

    @Test
    void seriesUsesPublicVisibilityCheckAndUnsupportedTypesAreRejected() {
        when(comments.listPreviewByObject("SERIES", "s1")).thenReturn(List.of());
        assertTrue(social.listCommentPreview("SERIES", "s1").isEmpty());
        verify(series).getPublicById("s1");
        assertThrows(ContractException.class, () -> social.listCommentPreview("UNKNOWN", "id"));
        verify(comments, never()).listPreviewByObject("UNKNOWN", "id");
    }

    @Test
    void guestCanOnlyAccessPreviewRoute() throws Exception {
        CommunityAccountService accounts = mock(CommunityAccountService.class);
        CommunityAuthInterceptor interceptor = new CommunityAuthInterceptor(accounts,
                mock(CommunityUserMapper.class), new ObjectMapper());
        assertTrue(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/v1/comments/preview/ARTICLE/a1"),
                new MockHttpServletResponse(), new Object()));
        verifyNoInteractions(accounts);
        when(accounts.requireActiveSession(null)).thenThrow(new ContractException(ErrorCode.AUTH_FORBIDDEN));
        for (String path : List.of("/api/v1/comments/ARTICLE/a1", "/api/v1/comments/lookup/c1")) {
            assertThrows(ContractException.class, () -> interceptor.preHandle(
                    new MockHttpServletRequest("GET", path), new MockHttpServletResponse(), new Object()));
        }
        verify(accounts, times(2)).requireActiveSession(null);
    }

    @Test
    void controllerRegistersPublicPreviewRoute() throws Exception {
        when(comments.listPreviewByObject("SERIES", "s1")).thenReturn(List.of());
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new CommunitySocialController(social, null)).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/comments/preview/series/s1"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().json("[]"));
        verify(series).getPublicById("s1");
    }
}
