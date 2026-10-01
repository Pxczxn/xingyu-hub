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
            WHERE a.lifecycle_status = 'ACTIVE'
              AND (a.moderation_status IS NULL OR a.moderation_status = 'NORMAL')
            """)
    List<String> listIndexableIds();

    @Select("""
            SELECT * FROM article
            WHERE space_id = #{spaceId}
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<Article> listBySpaceId(String spaceId, int limit);
}
