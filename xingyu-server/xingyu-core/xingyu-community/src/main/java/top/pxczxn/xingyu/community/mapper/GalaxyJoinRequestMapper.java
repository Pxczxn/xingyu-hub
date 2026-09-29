package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.GalaxyJoinRequest;

import java.util.List;

@Mapper
public interface GalaxyJoinRequestMapper extends BaseMapper<GalaxyJoinRequest> {

    @Select("""
            SELECT * FROM galaxy_join_request
            WHERE galaxy_id = #{galaxyId} AND user_id = #{userId} AND status = 'PENDING'
            LIMIT 1
            """)
    GalaxyJoinRequest findPending(String galaxyId, String userId);

    @Select("""
            SELECT * FROM galaxy_join_request
            WHERE galaxy_id = #{galaxyId} AND status = 'PENDING'
            ORDER BY created_at ASC
            LIMIT #{limit}
            """)
    List<GalaxyJoinRequest> listPendingByGalaxy(String galaxyId, int limit);
}
