package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.Comment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommentMapper extends BaseMapper<Comment> {

    @Select("""
            SELECT * FROM comment
            WHERE object_type = #{objectType} AND object_id = #{objectId} AND status = 'VISIBLE'
            ORDER BY created_at ASC
            """)
    List<Comment> listVisibleByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM comment
            WHERE object_type = #{objectType} AND object_id = #{objectId} AND status = 'VISIBLE'
            ORDER BY created_at ASC, id ASC
            LIMIT 3
            """)
    List<Comment> listPreviewByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM comment
            WHERE author_id = #{authorId} AND status = 'VISIBLE'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Comment> listByAuthorId(String authorId, int limit);

    @Select("SELECT COUNT(*) FROM comment WHERE author_id = #{authorId} AND status = 'VISIBLE'")
    long countByAuthorId(String authorId);

    /**
     * 落在该用户文章、动态、系列上的可见评论。隐藏评论不计入。
     * 创作台「收到评论」用这个口径，不用 {@link #countByAuthorId}。
     */
    @Select("""
            SELECT COUNT(*) FROM comment c
            WHERE c.status = 'VISIBLE'
              AND ((c.object_type = 'ARTICLE' AND EXISTS (
                    SELECT 1 FROM article a WHERE a.id = c.object_id AND a.owner_id = #{ownerId}))
                OR (c.object_type = 'MOMENT' AND EXISTS (
                    SELECT 1 FROM moment m WHERE m.id = c.object_id AND m.author_id = #{ownerId}))
                OR (c.object_type = 'SERIES' AND EXISTS (
                    SELECT 1 FROM series s WHERE s.id = c.object_id AND s.owner_id = #{ownerId})))
            """)
    long countVisibleOnOwnedContent(@Param("ownerId") String ownerId);

    /**
     * Comment counts for many objects of one type in a single round trip.
     *
     * <p>Only {@code VISIBLE} rows are counted, matching
     * {@link #listVisibleByObject}. Objects with zero comments are simply absent
     * from the result — callers must default to 0 rather than treat a missing key
     * as "unknown".
     *
     * <p>Callers must pass a non-empty list; an empty IN () is invalid SQL.
     */
    @Select("""
            <script>
            SELECT object_id AS objectId, COUNT(*) AS count
            FROM comment
            WHERE object_type = #{objectType}
              AND status = 'VISIBLE'
              AND object_id IN
              <foreach collection='objectIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            GROUP BY object_id
            </script>
            """)
    List<ObjectCountRow> countByObjectIds(
            @Param("objectType") String objectType, @Param("objectIds") List<String> objectIds);
}
