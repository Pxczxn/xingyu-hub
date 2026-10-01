package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CollectionEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;

@Mapper
public interface CollectionEntryMapper extends BaseMapper<CollectionEntry> {

    @Select("""
            SELECT * FROM collection_entry
            WHERE collection_id = #{collectionId}
            ORDER BY sort_order ASC, created_at ASC
            """)
    List<CollectionEntry> listByCollectionId(String collectionId);

    @Select("SELECT COUNT(*) FROM collection_entry WHERE collection_id = #{collectionId}")
    long countByCollectionId(String collectionId);

    /**
     * Whether this owner has this object in ANY of their collections.
     *
     * <p>⚠️ The table is `collection` — `UserCollection` is only the entity's Java name
     * (`@TableName("collection")`). This query used to join a non-existent `user_collection`,
     * so it threw "table doesn't exist" on EVERY call. That is the real reason bookmarking
     * looked broken: `POST /me/bookmarks` went through `findEntry` (a different query) and
     * therefore persisted correctly and answered 200, while `GET /bookmarks/status` and
     * `DELETE /me/bookmarks` — which both go through THIS method — could never see the row.
     * Verified fixed against a real DB on 2026-09-29.
     */
    @Select("""
            SELECT ce.* FROM collection_entry ce
            JOIN collection uc ON uc.id = ce.collection_id
            WHERE uc.owner_id = #{ownerId}
              AND ce.object_type = #{objectType}
              AND ce.object_id = #{objectId}
            LIMIT 1
            """)
    CollectionEntry findByOwnerAndObject(String ownerId, String objectType, String objectId);

    @Select("""
            SELECT COUNT(*) FROM collection_entry
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    long countByObject(@Param("objectType") String objectType, @Param("objectId") String objectId);

    @Select("""
            <script>
            SELECT object_id AS objectId, COUNT(*) AS count
            FROM collection_entry
            WHERE object_type = #{objectType}
              AND object_id IN
              <foreach collection='objectIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            GROUP BY object_id
            </script>
            """)
    List<ObjectCountRow> countByObjectIds(
            @Param("objectType") String objectType, @Param("objectIds") List<String> objectIds);

    /**
     * Which of `objectIds` this owner has already bookmarked, in one round trip.
     *
     * <p>Same shape of batching as {@link #countByObjectIds}, but VIEWER-SCOPED: the answer
     * differs per user, which is why callers must pass a real owner. A feed cannot ask this
     * per row without turning a 10-row page into 10 requests.
     *
     * <p>Note the join target is `collection` — `UserCollection` is only the entity's Java
     * name (`@TableName("collection")`), and a previous version of {@link #findByOwnerAndObject}
     * got that wrong.
     *
     * <p>Callers must pass a non-empty list; an empty IN () is invalid SQL.
     */
    @Select("""
            <script>
            SELECT DISTINCT ce.object_id FROM collection_entry ce
            JOIN collection uc ON uc.id = ce.collection_id
            WHERE uc.owner_id = #{ownerId}
              AND ce.object_type = #{objectType}
              AND ce.object_id IN
              <foreach collection='objectIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            </script>
            """)
    List<String> findBookmarkedObjectIds(
            @Param("ownerId") String ownerId,
            @Param("objectType") String objectType,
            @Param("objectIds") List<String> objectIds);
}
