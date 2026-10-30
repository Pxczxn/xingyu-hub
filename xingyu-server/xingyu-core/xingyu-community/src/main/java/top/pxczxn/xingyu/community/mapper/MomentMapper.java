package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Moment;
import org.apache.ibatis.annotations.Mapper;
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
