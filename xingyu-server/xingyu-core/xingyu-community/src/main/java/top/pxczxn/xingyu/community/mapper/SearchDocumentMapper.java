package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SearchDocumentMapper extends BaseMapper<SearchDocument> {

    @Select("""
            SELECT sd.* FROM search_document sd
            WHERE sd.removed_at IS NULL
              AND (sd.title LIKE CONCAT('%', #{query}, '%') OR sd.summary LIKE CONCAT('%', #{query}, '%'))
            ORDER BY sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> searchActiveByLatest(String query, int limit);

    @Select("""
            SELECT sd.* FROM search_document sd
            LEFT JOIN (
              SELECT object_type, object_id, COUNT(*) AS like_count
              FROM content_like
              GROUP BY object_type, object_id
            ) lc ON lc.object_type = sd.object_type AND lc.object_id = sd.object_id
            WHERE sd.removed_at IS NULL
              AND (sd.title LIKE CONCAT('%', #{query}, '%') OR sd.summary LIKE CONCAT('%', #{query}, '%'))
            ORDER BY COALESCE(lc.like_count, 0) DESC, sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> searchActiveByHot(String query, int limit);

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
            ORDER BY indexed_at DESC, object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByLatest(int limit);

    @Select("""
            SELECT sd.* FROM search_document sd
            LEFT JOIN (
              SELECT object_type, object_id, COUNT(*) AS like_count
              FROM content_like
              GROUP BY object_type, object_id
            ) lc ON lc.object_type = sd.object_type AND lc.object_id = sd.object_id
            WHERE sd.removed_at IS NULL
            ORDER BY COALESCE(lc.like_count, 0) DESC, sd.indexed_at DESC, sd.object_id DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActiveByHot(int limit);

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
}
