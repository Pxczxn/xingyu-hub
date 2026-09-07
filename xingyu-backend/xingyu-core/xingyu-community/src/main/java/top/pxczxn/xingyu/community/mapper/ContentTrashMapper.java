package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.ContentTrash;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ContentTrashMapper extends BaseMapper<ContentTrash> {

    @Select("""
            SELECT * FROM content_trash
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    ContentTrash findByObject(String objectType, String objectId);

    @Select("""
            SELECT * FROM content_trash
            WHERE owner_id = #{ownerId}
            ORDER BY trashed_at DESC
            """)
    List<ContentTrash> listByOwnerId(String ownerId);

    @Delete("""
            DELETE FROM content_trash
            WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    int deleteByObject(String objectType, String objectId);
}
