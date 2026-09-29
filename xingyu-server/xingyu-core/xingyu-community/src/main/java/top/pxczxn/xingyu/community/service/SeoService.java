package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.SeoMetadataView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.SeoMetadata;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeoMetadataMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SeoService {

    public static final String OBJECT_TYPE_ARTICLE = "ARTICLE";

    private final SeoMetadataMapper seoMetadataMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final ArticleMapper articleMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;

    @Value("${xingyu.community.public-base-url:http://localhost:3000}")
    private String publicBaseUrl;

    public SeoMetadataView getForArticle(String articleId) {
        SeoMetadata metadata = seoMetadataMapper.findByObject(OBJECT_TYPE_ARTICLE, articleId);
        if (metadata != null) {
            return toView(metadata);
        }
        Article article = articleMapper.selectById(articleId);
        if (article == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        PublishedRevision published = publishedRevisionMapper.findByArticleId(articleId);
        if (published == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        FormalRevision revision = formalRevisionMapper.selectById(published.getFormalRevisionId());
        if (revision == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return SeoMetadataView.builder()
                .objectType(OBJECT_TYPE_ARTICLE)
                .objectId(articleId)
                .title(revision.getTitle())
                .description(revision.getSummary())
                .canonicalUrl("/articles/" + articleId)
                .ogImageUrl(null)
                .build();
    }

    @Transactional
    public SeoMetadataView upsertArticleMetadata(String articleId, Map<String, String> body) {
        Article article = articleMapper.selectById(articleId);
        if (article == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Instant now = Instant.now();
        SeoMetadata existing = seoMetadataMapper.findByObject(OBJECT_TYPE_ARTICLE, articleId);
        SeoMetadata metadata = existing;
        if (metadata == null) {
            metadata = new SeoMetadata();
            metadata.setId(TokenSupport.newId());
            metadata.setObjectType(OBJECT_TYPE_ARTICLE);
            metadata.setObjectId(articleId);
        }
        if (body.containsKey("title")) {
            metadata.setTitle(trimToNull(body.get("title")));
        }
        if (body.containsKey("description")) {
            metadata.setDescription(trimToNull(body.get("description")));
        }
        if (body.containsKey("canonicalUrl")) {
            metadata.setCanonicalUrl(trimToNull(body.get("canonicalUrl")));
        }
        if (body.containsKey("ogImageUrl")) {
            metadata.setOgImageUrl(trimToNull(body.get("ogImageUrl")));
        }
        metadata.setUpdatedAt(now);
        if (existing == null) {
            seoMetadataMapper.insert(metadata);
        } else {
            seoMetadataMapper.updateById(metadata);
        }
        return toView(metadata);
    }

    public String buildSitemapXml() {
        List<SearchDocument> entries = searchDocumentMapper.listActiveByObjectType(OBJECT_TYPE_ARTICLE, 500);
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        appendSitemapUrl(xml, "/", null);
        appendSitemapUrl(xml, "/discover", null);
        appendSitemapUrl(xml, "/events", null);
        appendSitemapUrl(xml, "/announcements", null);
        for (SearchDocument entry : entries) {
            appendSitemapUrl(xml, "/articles/" + entry.getObjectId(), entry.getIndexedAt());
        }
        xml.append("</urlset>");
        return xml.toString();
    }

    public String buildRssXml() {
        List<SearchDocument> entries = searchDocumentMapper.listActiveByObjectType(OBJECT_TYPE_ARTICLE, 50);
        String siteUrl = trimTrailingSlash(publicBaseUrl);
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\"><channel>\n");
        xml.append("<title>").append(escapeXml("星语社区")).append("</title>\n");
        xml.append("<link>").append(escapeXml(siteUrl)).append("</link>\n");
        xml.append("<description>").append(escapeXml("星语社区最新公开文章")).append("</description>\n");
        for (SearchDocument entry : entries) {
            String link = siteUrl + "/articles/" + entry.getObjectId();
            xml.append("<item><title>").append(escapeXml(nullToEmpty(entry.getTitle()))).append("</title>");
            xml.append("<link>").append(escapeXml(link)).append("</link>");
            if (entry.getSummary() != null) {
                xml.append("<description>").append(escapeXml(entry.getSummary())).append("</description>");
            }
            if (entry.getIndexedAt() != null) {
                xml.append("<pubDate>").append(entry.getIndexedAt()).append("</pubDate>");
            }
            xml.append("<guid>").append(escapeXml(link)).append("</guid></item>\n");
        }
        xml.append("</channel></rss>");
        return xml.toString();
    }

    private void appendSitemapUrl(StringBuilder xml, String path, Instant lastMod) {
        String loc = trimTrailingSlash(publicBaseUrl) + path;
        xml.append("  <url><loc>").append(escapeXml(loc)).append("</loc>");
        if (lastMod != null) {
            xml.append("<lastmod>").append(lastMod).append("</lastmod>");
        }
        xml.append("</url>\n");
    }

    private SeoMetadataView toView(SeoMetadata metadata) {
        return SeoMetadataView.builder()
                .objectType(metadata.getObjectType())
                .objectId(metadata.getObjectId())
                .title(metadata.getTitle())
                .description(metadata.getDescription())
                .canonicalUrl(metadata.getCanonicalUrl())
                .ogImageUrl(metadata.getOgImageUrl())
                .build();
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String escapeXml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://localhost:3000";
        }
        String trimmed = value.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
