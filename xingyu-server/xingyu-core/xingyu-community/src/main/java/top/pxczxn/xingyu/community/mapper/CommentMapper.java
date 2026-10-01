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
            WHERE author_id = #{authorId} AND status = 'VISIBLE'
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<Comment> listByAuthorId(String authorId, int limit);

    @Select("SELECT COUNT(*) FROM comment WHERE author_id = #{authorId} AND status = 'VISIBLE'")
    long countByAuthorId(String authorId);

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
