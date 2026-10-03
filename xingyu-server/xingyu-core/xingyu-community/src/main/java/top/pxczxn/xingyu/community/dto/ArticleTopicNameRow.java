package top.pxczxn.xingyu.community.dto;

import lombok.Value;

/**
 * One (article, topic-name) link, used to batch-resolve feed tags.
 *
 * <p>Mirrors {@link ObjectCountRow}: a two-column projection mapped through the
 * generated all-args constructor. Keep the column aliases equal to the field
 * names or MyBatis' automatic constructor mapping will not bind them.
 */
@Value
public class ArticleTopicNameRow {
    String articleId;
    String name;
}
