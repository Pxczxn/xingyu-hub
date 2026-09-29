package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CreationSpaceCategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CreationSpaceCategoryMapper extends BaseMapper<CreationSpaceCategory> {

    @Select("""
            SELECT * FROM creation_space_category
            WHERE space_id = #{spaceId}
            ORDER BY sort_order ASC, created_at ASC
            """)
    List<CreationSpaceCategory> listBySpaceId(String spaceId);

    @Select("""
            SELECT * FROM creation_space_category
            WHERE space_id = #{spaceId} AND slug = #{slug}
            LIMIT 1
            """)
    CreationSpaceCategory findBySpaceIdAndSlug(String spaceId, String slug);
}
