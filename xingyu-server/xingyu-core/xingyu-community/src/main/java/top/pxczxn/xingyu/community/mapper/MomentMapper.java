package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Moment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MomentMapper extends BaseMapper<Moment> {

    @Select("""
            SELECT * FROM moment
            WHERE status = 'PUBLISHED'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Moment> listPublished(int limit);

    /** Every moment that belongs in the public index (bulk form, for a rebuild). */
    @Select("SELECT id FROM moment WHERE status = 'PUBLISHED'")
    List<String> listIndexableIds();

    /**
     * 作者动态按 {@code (created_at DESC, id DESC)} 排序。
     *
     * <p>id 是同秒之内的稳定次序：{@link #listByAuthorIdAfter} 的 keyset 边界读的正是这两列，
     * 首屏若只按 created_at 排，同一时间戳的多条会在翻页时重复或丢失。
     */
    @Select("""
            SELECT * FROM moment
            WHERE author_id = #{authorId} AND status = 'PUBLISHED'
            ORDER BY created_at DESC, id DESC
            LIMIT #{limit}
            """)
    List<Moment> listByAuthorId(String authorId, int limit);

    /**
     * 每个作者最近 N 条已发布动态。窗口先按作者截断，再交给调用方做可见性过滤，
     * 隐藏项不会用更早的动态回填。
     */
    @Select("""
            <script>
            SELECT m2.* FROM (
                SELECT m.id AS moment_id,
                       ROW_NUMBER() OVER (PARTITION BY m.author_id ORDER BY m.created_at DESC, m.id DESC) rn
                FROM moment m
                WHERE m.status = 'PUBLISHED'
                  AND m.author_id IN
                  <foreach collection='authorIds' item='authorId' open='(' separator=',' close=')'>#{authorId}</foreach>
            ) ranked
            INNER JOIN moment m2 ON m2.id = ranked.moment_id
            WHERE ranked.rn &lt;= #{perAuthorLimit}
            </script>
            """)
    List<Moment> listRecentByAuthorIds(
            @Param("authorIds") List<String> authorIds,
            @Param("perAuthorLimit") int perAuthorLimit);

    /** {@link #listByAuthorId} 的游标续读：严格早于边界三元组的下一段。 */
    @Select("""
            SELECT * FROM moment
            WHERE author_id = #{authorId} AND status = 'PUBLISHED'
              AND (created_at < #{cursorCreatedAt}
                   OR (created_at = #{cursorCreatedAt} AND id < #{cursorId}))
            ORDER BY created_at DESC, id DESC
            LIMIT #{limit}
            """)
    List<Moment> listByAuthorIdAfter(
            String authorId,
            java.time.Instant cursorCreatedAt,
            String cursorId,
            int limit);

    @Select("""
            SELECT COUNT(*) FROM moment
            WHERE author_id = #{authorId} AND status = 'PUBLISHED'
            """)
    long countPublishedByAuthorId(String authorId);
}
