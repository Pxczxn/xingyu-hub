package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SearchDocumentMapper extends BaseMapper<SearchDocument> {

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
              AND (title LIKE CONCAT('%', #{query}, '%') OR summary LIKE CONCAT('%', #{query}, '%'))
            ORDER BY indexed_at DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> searchActive(String query, int limit);

    @Select("""
            SELECT * FROM search_document
            WHERE removed_at IS NULL
            ORDER BY indexed_at DESC
            LIMIT #{limit}
            """)
    List<SearchDocument> listActive(int limit);

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
