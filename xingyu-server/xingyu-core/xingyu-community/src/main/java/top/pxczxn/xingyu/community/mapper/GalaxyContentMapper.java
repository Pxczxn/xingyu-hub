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

    /**
     * 星系可见内容计数（详情页 contentCount，Galaxy Identity Contract 2026-10-10）。
     * 必须与 listContent 的可见性语义一致（listContent → findLiveByTypeAndIds）：
     * JOIN 活文档（removed_at IS NULL），被治理隐藏的内容不计入公开计数。
     */
    @Select("""
            SELECT COUNT(*) FROM galaxy_content gc
            JOIN search_document sd
              ON sd.object_type = gc.object_type AND sd.object_id = gc.object_id
            WHERE gc.galaxy_id = #{galaxyId} AND sd.removed_at IS NULL
            """)
    long countByGalaxyId(String galaxyId);
}
