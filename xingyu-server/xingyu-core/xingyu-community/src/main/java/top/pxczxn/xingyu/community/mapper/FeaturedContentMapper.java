package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.FeaturedContent;

import java.util.List;

@Mapper
public interface FeaturedContentMapper extends BaseMapper<FeaturedContent> {

    @Select("""
            SELECT * FROM featured_content
            WHERE status = 'ACTIVE'
            ORDER BY sort_order ASC, created_at DESC
            LIMIT #{limit}
            """)
    List<FeaturedContent> listActive(int limit);

    @Select("""
            SELECT * FROM featured_content
            ORDER BY status ASC, sort_order ASC, created_at DESC
            LIMIT #{limit}
            """)
    List<FeaturedContent> listAll(int limit);

    /**
     * 发现页精选 keyset：只含仍在公开索引中的 ACTIVE 行。
     * 排序键是 (sort_order, id)，不随点赞变化。
     */
    @Select("""
            <script>
            SELECT fc.* FROM featured_content fc
            INNER JOIN search_document sd
              ON sd.object_type = fc.object_type
             AND sd.object_id = fc.object_id
             AND sd.removed_at IS NULL
            WHERE fc.status = 'ACTIVE'
            <if test="type != null">
              AND fc.object_type = #{type}
            </if>
            <if test="topicId != null">
              AND fc.object_type = 'ARTICLE'
              AND EXISTS (
                SELECT 1 FROM article_topic at
                WHERE at.article_id = fc.object_id AND at.topic_id = #{topicId}
              )
            </if>
            <if test="cursorId != null">
              AND (fc.sort_order &gt; #{cursorSortOrder}
                   OR (fc.sort_order = #{cursorSortOrder} AND fc.id &gt; #{cursorId}))
            </if>
            ORDER BY fc.sort_order ASC, fc.id ASC
            LIMIT #{limit}
            </script>
            """)
    List<FeaturedContent> listDiscover(
            @Param("topicId") String topicId,
            @Param("type") String type,
            @Param("cursorSortOrder") Integer cursorSortOrder,
            @Param("cursorId") String cursorId,
            @Param("limit") int limit);
}
