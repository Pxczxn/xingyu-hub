package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.dto.ArticleSeriesContextView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

@Mapper
public interface SeriesMapper extends BaseMapper<Series> {

    @Select("""
            SELECT * FROM series
            WHERE owner_id = #{ownerId}
            ORDER BY updated_at DESC
            """)
    List<Series> listByOwnerId(String ownerId);

    /** Every series that belongs in the public index (bulk form, for a rebuild). */
    @Select("SELECT id FROM series WHERE status = 'ACTIVE'")
    List<String> listIndexableIds();

    @Select("""
            SELECT * FROM series
            WHERE status = 'ACTIVE'
            ORDER BY updated_at DESC, id DESC
            LIMIT #{limit}
            """)
    List<Series> listActive(int limit);

    /**
     * 系列广场目录：keyset 分页 + 关键字过滤（2026-10-18）。
     *
     * <p>排序固定为 {@code (updated_at DESC, id DESC)}。只按 updated_at 排序时同秒更新的
     * 系列没有确定顺序，翻页会在边界处重复或跳过；id 是主键，补齐后是全序。
     *
     * <p>可见性（ACTIVE 且作者有公开档案）放在 SQL 里完成，而不是先 LIMIT 再在服务层
     * 丢掉无档案的系列——后者会让一页少于 limit 条，并让"还有下一页"的探针失真。
     *
     * <p>作者关键字匹配 username / display_name，因此必须 JOIN community_profile；
     * 这也正是公开可见性的判据（系列详情接口同样要求档案存在）。
     *
     * <p>{@code ownerId}（2026-10-30）让个人主页的“公开系列”复用同一份可见性 SQL：
     * 只是多一个作者条件，而不是复制一套查询。个人主页的档案可见性由调用方先校验。
     */
    @Select("""
            <script>
            SELECT s.* FROM series s
            INNER JOIN community_profile p ON p.user_id = s.owner_id
            WHERE s.status = 'ACTIVE'
            <if test="ownerId != null">
              AND s.owner_id = #{ownerId}
            </if>
            <if test="keyword != null">
              AND (s.title LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR s.description LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR p.username LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR p.display_name LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!')
            </if>
            <if test="cursorUpdatedAt != null">
              AND (s.updated_at &lt; #{cursorUpdatedAt}
                   OR (s.updated_at = #{cursorUpdatedAt} AND s.id &lt; #{cursorId}))
            </if>
            ORDER BY s.updated_at DESC, s.id DESC
            LIMIT #{limit}
            </script>
            """)
    List<Series> searchPublic(
            @Param("keyword") String keyword,
            @Param("ownerId") String ownerId,
            @Param("cursorUpdatedAt") Instant cursorUpdatedAt,
            @Param("cursorId") String cursorId,
            @Param("limit") int limit);

    /** 与 {@link #searchPublic} 同一可见性与过滤条件，用于返回真实的匹配总数。 */
    @Select("""
            <script>
            SELECT COUNT(*) FROM series s
            INNER JOIN community_profile p ON p.user_id = s.owner_id
            WHERE s.status = 'ACTIVE'
            <if test="keyword != null">
              AND (s.title LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR s.description LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR p.username LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!'
                OR p.display_name LIKE CONCAT('%', #{keyword}, '%') ESCAPE '!')
            </if>
            </script>
            """)
    long countPublic(@Param("keyword") String keyword);

    @Select("""
            SELECT * FROM series
            WHERE owner_id = #{ownerId} AND slug = #{slug}
            """)
    Series findByOwnerIdAndSlug(String ownerId, String slug);

    @Select("""
            SELECT s.* FROM series s
            JOIN community_profile p ON p.user_id = s.owner_id
            WHERE p.username = #{username} AND s.slug = #{slug} AND s.status = 'ACTIVE'
            """)
    Series findPublicByUsernameAndSlug(String username, String slug);

    @Select("""
            SELECT s.id, s.slug, s.title, sc.position
            FROM series_chapter sc
            INNER JOIN series s ON s.id = sc.series_id
            WHERE sc.article_id = #{articleId}
              AND s.status = 'ACTIVE'
            ORDER BY s.id ASC, sc.position ASC
            """)
    List<ArticleSeriesContextView> listActiveContextsByArticleId(String articleId);
}
