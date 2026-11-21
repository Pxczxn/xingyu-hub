package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import top.pxczxn.xingyu.community.entity.Article;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
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

    @Select("""
            SELECT COUNT(*) FROM article
            WHERE owner_id = #{ownerId} AND status = #{status}
            """)
    long countByOwnerAndStatus(@Param("ownerId") String ownerId, @Param("status") String status);

    @Select("""
            SELECT COUNT(*) FROM article
            WHERE owner_id = #{ownerId}
            """)
    long countByOwnerId(String ownerId);

    @Select("""
            SELECT * FROM article
            WHERE owner_id = #{ownerId}
              AND status = 'DRAFT'
              AND (
                lifecycle_status IS NULL
                OR TRIM(lifecycle_status) = ''
                OR UPPER(TRIM(lifecycle_status)) = 'ACTIVE'
              )
            ORDER BY updated_at DESC
            LIMIT #{limit}
            """)
    List<Article> listRecentActiveDrafts(@Param("ownerId") String ownerId, @Param("limit") int limit);

    @Select("""
            SELECT id FROM article
            WHERE owner_id = #{ownerId}
              AND status = 'IN_REVIEW'
              AND (
                lifecycle_status IS NULL
                OR TRIM(lifecycle_status) = ''
                OR UPPER(TRIM(lifecycle_status)) = 'ACTIVE'
              )
            ORDER BY updated_at DESC
            """)
    List<String> listActiveInReviewIds(String ownerId);

    @Select("""
            <script>
            SELECT * FROM article
            WHERE owner_id IN
            <foreach collection='ownerIds' item='oid' open='(' separator=',' close=')'>#{oid}</foreach>
            ORDER BY updated_at DESC
            </script>
            """)
    List<Article> listByOwnerIds(@Param("ownerIds") List<String> ownerIds);

    /**
     * 关注 Feed 用的活文章 Top-K：生命周期 ACTIVE 且 search_document 未下架。
     * 排序键是 article.updated_at（与 Feed 卡片 createdAt 一致），不是 indexed_at。
     */
    @Select("""
            <script>
            SELECT a.* FROM article a
            INNER JOIN search_document sd
              ON sd.object_type = 'ARTICLE' AND sd.object_id = a.id AND sd.removed_at IS NULL
            WHERE a.lifecycle_status = 'ACTIVE'
              AND a.owner_id IN
            <foreach collection='ownerIds' item='oid' open='(' separator=',' close=')'>#{oid}</foreach>
            ORDER BY a.updated_at DESC, a.id DESC
            LIMIT #{limit}
            </script>
            """)
    List<Article> listLiveByOwnerIds(@Param("ownerIds") List<String> ownerIds, @Param("limit") int limit);

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
     * 匿名调用公开详情时能读到的文章数。
     *
     * <p>与 {@code ArticleAccessService.findReadable(id, null)} 同一组条件：生命周期为
     * ACTIVE（空值按 ACTIVE）、治理状态不是 HIDDEN、发布指针和正式版本都在，可见性是
     * PUBLIC 或 UNLISTED。不看编辑状态 {@code article.status}。PRIVATE 对匿名读者不可读。
     * 搜索索引更严：它还排除 FROZEN 和 UNLISTED，那是发现口径，不是详情可读口径。</p>
     */
    @Select("""
            SELECT COUNT(*) FROM article a
            INNER JOIN published_revision pr ON pr.article_id = a.id
            INNER JOIN formal_revision fr ON fr.id = pr.formal_revision_id
            WHERE (a.lifecycle_status IS NULL OR a.lifecycle_status = ''
                   OR UPPER(TRIM(a.lifecycle_status)) = 'ACTIVE')
              AND UPPER(TRIM(COALESCE(a.moderation_status, 'NORMAL'))) <> 'HIDDEN'
              AND fr.visibility IN ('PUBLIC', 'UNLISTED')
            """)
    long countAnonymousReadable();

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

    /**
     * 管理端内容资产文章列表。分页插件追加 COUNT/LIMIT。
     * 关键词与原先 Java {@code String.contains} 一致：只匹配工作草稿标题，大小写敏感。
     * working_draft.article_id 唯一，JOIN 不会复制文章行。
     */
    @Select("""
            <script>
            SELECT a.* FROM article a
            <if test="keyword != null and keyword != ''">
            INNER JOIN working_draft wd ON wd.article_id = a.id
            </if>
            <where>
              <if test="status != null and status != ''">AND a.status = #{status}</if>
              <if test="keyword != null and keyword != ''">
                AND INSTR(wd.title COLLATE utf8mb4_bin, #{keyword}) &gt; 0
              </if>
            </where>
            ORDER BY a.id ASC
            </script>
            """)
    IPage<Article> pageForAdmin(IPage<Article> page, @Param("status") String status, @Param("keyword") String keyword);
}
