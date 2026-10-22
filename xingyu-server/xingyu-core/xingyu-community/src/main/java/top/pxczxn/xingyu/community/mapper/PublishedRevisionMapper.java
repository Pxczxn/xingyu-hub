package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PublishedRevisionMapper extends BaseMapper<PublishedRevision> {

    @Select("SELECT * FROM published_revision WHERE article_id = #{articleId} LIMIT 1")
    PublishedRevision findByArticleId(String articleId);

    @Select("SELECT * FROM published_revision WHERE publication_event_id = #{eventId} LIMIT 1")
    PublishedRevision findByPublicationEventId(String eventId);

    /**
     * 创作空间公开作品列表。
     *
     * <p>除可见性外还必须排除已删除（TRASHED）与治理隐藏（HIDDEN）的文章：这里不经过
     * search_document，没有索引管线兜底，必须在 SQL 里显式判断。
     * 不按 {@code article.status} 过滤——重新送审期间旧发布版本仍要展示。
     */
    @Select("""
            SELECT pr.* FROM published_revision pr
            INNER JOIN article a ON a.id = pr.article_id
            INNER JOIN formal_revision fr ON fr.id = pr.formal_revision_id
            WHERE a.space_id = #{spaceId}
              AND (a.lifecycle_status IS NULL OR a.lifecycle_status = 'ACTIVE')
              AND (a.moderation_status IS NULL OR a.moderation_status = 'NORMAL')
              AND fr.visibility IN ('PUBLIC', 'UNLISTED')
            ORDER BY pr.published_at DESC, pr.article_id DESC
            LIMIT #{limit}
            """)
    List<PublishedRevision> listPublicBySpaceId(String spaceId, int limit);
}
