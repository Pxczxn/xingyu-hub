package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

@Mapper
public interface SearchDocumentMapper extends BaseMapper<SearchDocument> {

    /**
     * Refreshes an existing index row, and clears a previous removal.
     *
     * <p>Written as an explicit UPDATE rather than `updateById` because of MyBatis-Plus'
     * NOT_NULL field strategy: `updateById` OMITS a field set to null, so `removed_at = NULL`
     * would silently never be written and a re-published object would stay invisible forever.
     */
    @Update("""
            UPDATE search_document
            SET title = #{title},
                summary = #{summary},
                discovery_version = #{discoveryVersion},
                indexed_at = #{indexedAt},
                removed_at = NULL
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    int refreshContent(
            @Param("objectType") String objectType,
            @Param("objectId") String objectId,
            @Param("title") String title,
            @Param("summary") String summary,
            @Param("discoveryVersion") long discoveryVersion,
            @Param("indexedAt") Instant indexedAt);

    /**
     * Marks an indexed object as no longer public.
     *
     * <p>The row is kept, not deleted: the unique key is (object_type, object_id), so keeping
     * it lets a later re-publish restore the SAME row instead of racing an insert.
     * `removed_at IS NULL` makes the call idempotent — a second removal changes nothing.
     */
    @Update("""
            UPDATE search_document
            SET removed_at = #{removedAt}
            WHERE object_type = #{objectType} AND object_id = #{objectId} AND removed_at IS NULL
            """)
    int markRemoved(
            @Param("objectType") String objectType,
            @Param("objectId") String objectId,
            @Param("removedAt") Instant removedAt);

    @Select("""
            SELECT sd.* FROM search_document sd
            WHERE sd.removed_at IS NULL
              AND (#{type} IS NULL OR sd.object_type = #{type})
              AND (sd.title LIKE CONCAT('%', #{query}, '%') ESCAPE '!'
                OR sd.summary LIKE CONCAT('%', #{query}, '%') ESCAPE '!')
            ORDER BY sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> searchActiveByLatest(
            @Param("query") String query, @Param("type") String type, @Param("limit") int limit);

    @Select("""
            SELECT sd.* FROM search_document sd
            LEFT JOIN (
              SELECT object_type, object_id, COUNT(*) AS like_count
              FROM content_like
              GROUP BY object_type, object_id
            ) lc ON lc.object_type = sd.object_type AND lc.object_id = sd.object_id
            WHERE sd.removed_at IS NULL
              AND (#{type} IS NULL OR sd.object_type = #{type})
              AND (sd.title LIKE CONCAT('%', #{query}, '%') ESCAPE '!'
                OR sd.summary LIKE CONCAT('%', #{query}, '%') ESCAPE '!')
            ORDER BY COALESCE(lc.like_count, 0) DESC, sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> searchActiveByHot(
            @Param("query") String query, @Param("type") String type, @Param("limit") int limit);

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
              AND (#{type} IS NULL OR object_type = #{type})
            ORDER BY indexed_at DESC, object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByLatest(@Param("type") String type, @Param("limit") int limit);

    @Select("""
            SELECT sd.* FROM search_document sd
            LEFT JOIN (
              SELECT object_type, object_id, COUNT(*) AS like_count
              FROM content_like
              GROUP BY object_type, object_id
            ) lc ON lc.object_type = sd.object_type AND lc.object_id = sd.object_id
            WHERE sd.removed_at IS NULL
              AND (#{type} IS NULL OR sd.object_type = #{type})
            ORDER BY COALESCE(lc.like_count, 0) DESC, sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByHot(@Param("type") String type, @Param("limit") int limit);

    @Select("""
            SELECT * FROM search_document
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    SearchDocument findByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL AND object_type = #{objectType}
            ORDER BY indexed_at DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByObjectType(String objectType, int limit);

    /** Health read: rows currently live in the index. */
    @Select("SELECT COUNT(*) FROM search_document WHERE removed_at IS NULL")
    long countLive();

    /** Health read: rows kept but marked not-public. */
    @Select("SELECT COUNT(*) FROM search_document WHERE removed_at IS NOT NULL")
    long countRemoved();

    /**
     * 批量取同类型的活文档（removed_at IS NULL）。供 Galaxy 内容行等聚合面使用：
     * 一类一批，避免逐行 findByObject（N+1）；已下架/删除的文档不在结果里，
     * 上层据此跳过对应行（下架联动，2026-10-10 Phase 4.2）。
     */
    @Select("""
            <script>
            SELECT * FROM search_document
            WHERE removed_at IS NULL AND object_type = #{objectType}
              AND object_id IN
              <foreach collection='objectIds' item='oid' open='(' separator=',' close=')'>#{oid}</foreach>
            </script>
            """)
    List<SearchDocument> findLiveByTypeAndIds(@Param("objectType") String objectType,
                                              @Param("objectIds") List<String> objectIds);

    /**
     * 发现页 keyset 分页（2026-10-11 Phase 5）：按 indexed_at DESC, object_id DESC
     * 稳定排序，cursor 为上一页末条的 (indexed_at, object_id)。like_count 排序
     * 不适合做 keyset（点赞数随时变化会导致跨页重复/丢失），故发现页统一走
     * 最新语义。
     */
    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
            ORDER BY indexed_at DESC, object_type ASC, object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByRecency(@Param("limit") int limit);

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
              AND (indexed_at < #{cursorIndexedAt}
                   OR (indexed_at = #{cursorIndexedAt}
                       AND (object_type > #{cursorObjectType}
                            OR (object_type = #{cursorObjectType}
                                AND object_id < #{cursorId}))))
            ORDER BY indexed_at DESC, object_type ASC, object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByRecencyAfter(
            @Param("cursorIndexedAt") java.time.Instant cursorIndexedAt,
            @Param("cursorObjectType") String cursorObjectType,
            @Param("cursorId") String cursorId,
            @Param("limit") int limit);
}
