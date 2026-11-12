package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.GalaxyMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface GalaxyMemberMapper extends BaseMapper<GalaxyMember> {

    @Select("""
            SELECT * FROM galaxy_member
            WHERE galaxy_id = #{galaxyId}
            ORDER BY joined_at ASC
            LIMIT #{limit}
            """)
    List<GalaxyMember> listByGalaxyId(String galaxyId, int limit);

    @Select("""
            SELECT * FROM galaxy_member
            WHERE user_id = #{userId}
            ORDER BY joined_at DESC
            """)
    List<GalaxyMember> listByUserId(String userId);

    @Select("""
            SELECT * FROM galaxy_member
            WHERE galaxy_id = #{galaxyId} AND user_id = #{userId}
            LIMIT 1
            """)
    GalaxyMember findByGalaxyAndUser(String galaxyId, String userId);

    @Select("SELECT COUNT(*) FROM galaxy_member WHERE galaxy_id = #{galaxyId}")
    long countByGalaxyId(String galaxyId);

    @Select("""
            <script>
            SELECT galaxy_id AS objectId, COUNT(*) AS count
            FROM galaxy_member
            WHERE galaxy_id IN
            <foreach collection='galaxyIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>
            GROUP BY galaxy_id
            </script>
            """)
    List<ObjectCountRow> countByGalaxyIds(@Param("galaxyIds") List<String> galaxyIds);
}
