package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class ArticlePublicView {
    String id;
    String title;
    String summary;
    String bodyMode;
    String body;
    String slug;
    String visibility;
    String spaceSlug;
    String ownerUsername;
    String categorySlug;
    List<String> topicSlugs;
    Instant publishedAt;
    boolean owner;
}
