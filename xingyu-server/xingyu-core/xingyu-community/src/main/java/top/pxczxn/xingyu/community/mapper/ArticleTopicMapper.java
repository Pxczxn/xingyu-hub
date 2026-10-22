package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.ArticleTopicNameRow;
import top.pxczxn.xingyu.community.dto.TopicActivityStat;
import top.pxczxn.xingyu.community.dto.TopicOwnerStat;
import top.pxczxn.xingyu.community.entity.ArticleTopic;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Collection;
import java.util.List;
import java.time.Instant;

@Mapper
public interface ArticleTopicMapper extends BaseMapper<ArticleTopic> {

    @Select("SELECT * FROM article_topic WHERE article_id = #{articleId}")
    List<ArticleTopic> listByArticleId(String articleId);

    /**
     * Topic names for many articles in one round trip, for feed tags.
     *
     * <p>Topics are the ONLY tag source this codebase has — there is no free-form
     * tag column — so a feed tag is literally "a topic this article was filed
     * under". Articles with no topics are absent from the result; callers must
     * treat that as "no tags", not as "unknown".
     *
     * <p>Callers must pass a non-empty list; an empty IN () is invalid SQL.
     */
    @Select("""
            <script>
            SELECT at.article_id AS articleId, t.name AS name
            FROM article_topic at
            INNER JOIN topic t ON t.id = at.topic_id
            WHERE at.article_id IN
            <foreach collection='articleIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            ORDER BY at.article_id ASC, t.name ASC
            </script>
            """)
    List<ArticleTopicNameRow> listTopicNamesByArticleIds(@Param("articleIds") Collection<String> articleIds);

    @Select("SELECT * FROM article_topic WHERE topic_id = #{topicId}")
    List<ArticleTopic> listByTopicId(String topicId);

    @Delete("DELETE FROM article_topic WHERE article_id = #{articleId}")
    int deleteByArticleId(String articleId);

    @Delete("DELETE FROM article_topic WHERE article_id = #{articleId} AND topic_id = #{topicId}")
    int deleteLink(String articleId, String topicId);

    @Select("""
            SELECT COUNT(*) FROM article_topic at
            INNER JOIN article a ON a.id = at.article_id
            INNER JOIN search_document sd ON sd.object_type = 'ARTICLE'
              AND sd.object_id = a.id
              AND sd.removed_at IS NULL
            WHERE at.topic_id = #{topicId}
            """)
    long countPublicContent(String topicId);

    @Select("""
            SELECT sd.* FROM search_document sd
            INNER JOIN article_topic at ON at.article_id = sd.object_id
            INNER JOIN article a ON a.id = at.article_id
            WHERE at.topic_id = #{topicId}
              AND sd.object_type = 'ARTICLE'
              AND sd.removed_at IS NULL
            ORDER BY sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listLatestContent(String topicId, int limit);

    @Select("""
            SELECT sd.* FROM search_document sd
            INNER JOIN article_topic at ON at.article_id = sd.object_id
            INNER JOIN article a ON a.id = at.article_id
            LEFT JOIN (
              SELECT object_id, COUNT(*) AS like_count
              FROM content_like
              WHERE object_type = 'ARTICLE'
              GROUP BY object_id
            ) lc ON lc.object_id = sd.object_id
            WHERE at.topic_id = #{topicId}
              AND sd.object_type = 'ARTICLE'
              AND sd.removed_at IS NULL
            ORDER BY COALESCE(lc.like_count, 0) DESC, sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listHotContent(String topicId, int limit);

    @Select("""
            SELECT a.owner_id AS ownerId, COUNT(*) AS contentCount
            FROM article a
            INNER JOIN article_topic at ON at.article_id = a.id
            INNER JOIN search_document sd ON sd.object_type = 'ARTICLE'
              AND sd.object_id = a.id
              AND sd.removed_at IS NULL
            WHERE at.topic_id = #{topicId}
            GROUP BY a.owner_id
            ORDER BY contentCount DESC, a.owner_id ASC
            LIMIT #{limit}
            """)
    List<TopicOwnerStat> listTopOwners(String topicId, int limit);

    /**
     * 每个话题最近一次公开文章发布时间，一次查询返回全部话题（不做 per-topic 查询，
     * 广场列表因此不会因为话题数量增长变成 N+1）。
     *
     * <p>{@code published_revision} 在 {@code article_id} 上有唯一键，一篇文章只保留
     * 当前已发布修订，所以 {@code MAX(published_at)} 就是「这个话题下最新一篇公开文章
     * 是什么时候发的」。
     *
     * <p>可见性判据与 {@link #countPublicContent} / {@link #listLatestContent} 保持一致：
     * 只统计仍有活索引行（{@code removed_at IS NULL}）的文章。发布版本、生命周期与治理状态
     * 由索引管线统一维护；重新送审不会移除索引，因此旧发布版本在此期间仍计入活跃。
     */
    @Select("""
            SELECT at.topic_id AS topicId, MAX(pr.published_at) AS lastPublishedAt
            FROM article_topic at
            INNER JOIN article a ON a.id = at.article_id
            INNER JOIN published_revision pr ON pr.article_id = a.id
            INNER JOIN search_document sd ON sd.object_type = 'ARTICLE'
              AND sd.object_id = a.id
              AND sd.removed_at IS NULL
            GROUP BY at.topic_id
            """)
    List<TopicActivityStat> listTopicActivity();

    /** 单个话题的最近一次公开文章发布时间；没有公开文章时为 null。 */
    @Select("""
            SELECT MAX(pr.published_at)
            FROM article_topic at
            INNER JOIN article a ON a.id = at.article_id
            INNER JOIN published_revision pr ON pr.article_id = a.id
            INNER JOIN search_document sd ON sd.object_type = 'ARTICLE'
              AND sd.object_id = a.id
              AND sd.removed_at IS NULL
            WHERE at.topic_id = #{topicId}
            """)
    Instant findLastPublishedAt(String topicId);
}
