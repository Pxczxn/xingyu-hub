package top.pxczxn.xingyu.community.dto;

import lombok.Data;

import java.time.Instant;

/**
 * 一个话题的最近发布活动。
 *
 * <p>口径：该话题下「公开可见文章」最晚一次 {@code published_revision.published_at}。
 * 用发布时间而不是 {@code search_document.indexed_at}：后者是索引写入时间，重建索引或
 * 重新入库都会把它刷新，不能当作内容时间（同一判断写在 V037 的注释与前端 Feed 的说明里）。
 *
 * <p>可见性判据与 {@code countPublicContent} / {@code listLatestContent} 保持一致
 * （article.status = PUBLISHED 且索引行未移除），这样一个话题的「最近活跃」不会指向
 * 它在内容列表里看不到的文章。
 */
@Data
public class TopicActivityStat {
    private String topicId;
    private Instant lastPublishedAt;
}
