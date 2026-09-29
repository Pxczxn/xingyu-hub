package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.GalaxyContent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GalaxyContentMapper extends BaseMapper<GalaxyContent> {

    @Select("""
            SELECT * FROM galaxy_content
            WHERE galaxy_id = #{galaxyId}
            ORDER BY pinned DESC, created_at DESC
            LIMIT #{limit}
            """)
    List<GalaxyContent> listByGalaxyId(String galaxyId, int limit);
}
