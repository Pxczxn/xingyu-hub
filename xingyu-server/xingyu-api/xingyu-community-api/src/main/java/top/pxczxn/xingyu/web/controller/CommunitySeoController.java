package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.dto.SeoMetadataView;
import top.pxczxn.xingyu.community.service.SeoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CommunitySeoController {

    private final SeoService seoService;

    @GetMapping("/articles/{articleId}/seo")
    public SeoMetadataView articleSeo(@PathVariable String articleId) {
        return seoService.getForArticle(articleId);
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap() {
        return seoService.buildSitemapXml();
    }

    @GetMapping(value = "/feed.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String rssFeed() {
        return seoService.buildRssXml();
    }
}
