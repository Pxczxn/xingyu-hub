package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeoMetadataMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SeoServicePublicUrlTest {

    @Test
    void sitemapAndCanonicalUseConfiguredPublicOrigin() {
        SeoMetadataMapper seoMetadataMapper = mock(SeoMetadataMapper.class);
        SearchDocumentMapper searchDocumentMapper = mock(SearchDocumentMapper.class);
        ArticleMapper articleMapper = mock(ArticleMapper.class);
        PublishedRevisionMapper publishedRevisionMapper = mock(PublishedRevisionMapper.class);
        FormalRevisionMapper formalRevisionMapper = mock(FormalRevisionMapper.class);
        CommunityProperties properties = new CommunityProperties();
        properties.setPublicBaseUrl("https://pxczxn.top/");

        when(searchDocumentMapper.listActiveByObjectType(SeoService.OBJECT_TYPE_ARTICLE, 500))
                .thenReturn(List.of());
        when(searchDocumentMapper.listActiveByObjectType(SeoService.OBJECT_TYPE_ARTICLE, 50))
                .thenReturn(List.of());
        when(seoMetadataMapper.findByObject(SeoService.OBJECT_TYPE_ARTICLE, "article-1"))
                .thenReturn(null);
        Article article = new Article();
        article.setId("article-1");
        when(articleMapper.selectById("article-1")).thenReturn(article);
        PublishedRevision published = new PublishedRevision();
        published.setFormalRevisionId("rev-1");
        when(publishedRevisionMapper.findByArticleId("article-1")).thenReturn(published);
        FormalRevision revision = new FormalRevision();
        revision.setTitle("Hello");
        revision.setSummary("World");
        when(formalRevisionMapper.selectById("rev-1")).thenReturn(revision);

        SeoService service = new SeoService(
                seoMetadataMapper,
                searchDocumentMapper,
                articleMapper,
                publishedRevisionMapper,
                formalRevisionMapper,
                properties);

        assertThat(service.buildSitemapXml())
                .contains("<loc>https://pxczxn.top/</loc>")
                .contains("<loc>https://pxczxn.top/discover</loc>")
                .doesNotContain("localhost")
                .doesNotContain("127.0.0.1");
        assertThat(service.buildRssXml())
                .contains("<link>https://pxczxn.top</link>")
                .doesNotContain("localhost");
        assertThat(service.getForArticle("article-1").getCanonicalUrl())
                .isEqualTo("https://pxczxn.top/articles/article-1");
    }
}
