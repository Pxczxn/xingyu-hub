package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.TopicOwnerStat;
import top.pxczxn.xingyu.community.entity.ArticleTopic;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ArticleTopicMapper extends BaseMapper<ArticleTopic> {

    @Select("SELECT * FROM article_topic WHERE article_id = #{articleId}")
    List<ArticleTopic> listByArticleId(String articleId);

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
              AND a.status = 'PUBLISHED'
            """)
    long countPublicContent(String topicId);

    @Select("""
            SELECT sd.* FROM search_document sd
            INNER JOIN article_topic at ON at.article_id = sd.object_id
            INNER JOIN article a ON a.id = at.article_id
            WHERE at.topic_id = #{topicId}
              AND sd.object_type = 'ARTICLE'
              AND sd.removed_at IS NULL
              AND a.status = 'PUBLISHED'
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
              AND a.status = 'PUBLISHED'
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
              AND a.status = 'PUBLISHED'
            GROUP BY a.owner_id
            ORDER BY contentCount DESC, a.owner_id ASC
            LIMIT #{limit}
            """)
    List<TopicOwnerStat> listTopOwners(String topicId, int limit);
}
