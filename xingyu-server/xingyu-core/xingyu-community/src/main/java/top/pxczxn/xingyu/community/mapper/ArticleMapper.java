package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Article;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ArticleMapper extends BaseMapper<Article> {

    @Select("""
            SELECT * FROM article
            WHERE owner_id = #{ownerId}
            ORDER BY updated_at DESC
            """)
    List<Article> listByOwnerId(String ownerId);

    /**
     * Every article that belongs in the public index: published at least once, not trashed,
     * not under a moderation measure.
     *
     * <p>The per-object authority is `SearchIndexService.isPublic`; this is only the BULK form
     * a rebuild needs, so the two must be kept in step. Note it keys on the presence of a
     * `published_revision` row rather than on `status` — submitting a new revision sets the
     * article back to IN_REVIEW while the previous revision stays publicly readable.
     */
    @Select("""
            SELECT a.id FROM article a
            INNER JOIN published_revision pr ON pr.article_id = a.id
            INNER JOIN formal_revision fr ON fr.id = pr.formal_revision_id
            WHERE a.lifecycle_status = 'ACTIVE'
              AND (a.moderation_status IS NULL OR a.moderation_status = 'NORMAL')
              AND fr.visibility = 'PUBLIC'
            """)
    List<String> listIndexableIds();

    /**
     * Public article count for a profile, keyed on the presence of a published revision
     * rather than on {@code article.status}: submitting a new revision flips the article to
     * IN_REVIEW while the published one stays readable, so a status-based count would drop a
     * still-public article. Lifecycle/moderation keep trashed or suppressed articles out.
     */
    @Select("""
            SELECT COUNT(*) FROM article a
            INNER JOIN published_revision pr ON pr.article_id = a.id
            WHERE a.owner_id = #{ownerId}
              AND (a.lifecycle_status IS NULL OR a.lifecycle_status = 'ACTIVE')
              AND (a.moderation_status IS NULL OR a.moderation_status = 'NORMAL')
            """)
    long countPublishedByOwnerId(String ownerId);

    @Select("""
            SELECT * FROM article
            WHERE space_id = #{spaceId}
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<Article> listBySpaceId(String spaceId, int limit);
}
