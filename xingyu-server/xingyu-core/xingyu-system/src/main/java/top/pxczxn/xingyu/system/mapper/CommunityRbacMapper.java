package top.pxczxn.xingyu.system.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.system.rbac.CommunityGrantedRole;

import java.util.List;

/**
 * 社区 RBAC 只读查询。授权仅来自 {@code community_user_role}。
 */
@Mapper
public interface CommunityRbacMapper {

    @Select("""
            SELECT r.id, r.code, r.name
            FROM community_user_role cur
            INNER JOIN sys_role r ON r.id = cur.role_id
            WHERE cur.community_user_id = #{communityUserId}
              AND r.status = 1
              AND r.deleted = 0
            ORDER BY r.sort, r.id
            """)
    List<CommunityGrantedRole> selectRolesByCommunityUserId(@Param("communityUserId") String communityUserId);

    @Select("""
            SELECT DISTINCT m.permission
            FROM community_user_role cur
            INNER JOIN sys_role r ON r.id = cur.role_id
            INNER JOIN sys_role_menu rm ON rm.role_id = r.id
            INNER JOIN sys_menu m ON m.id = rm.menu_id
            WHERE cur.community_user_id = #{communityUserId}
              AND r.status = 1
              AND r.deleted = 0
              AND m.status = 1
              AND m.deleted = 0
              AND m.permission IS NOT NULL
              AND m.permission != ''
            """)
    List<String> selectPermissionsByCommunityUserId(@Param("communityUserId") String communityUserId);

    @Select("""
            SELECT cur.community_user_id
            FROM community_user_role cur
            INNER JOIN sys_role r ON r.id = cur.role_id
            WHERE r.code = #{roleCode}
              AND r.status = 1
              AND r.deleted = 0
            """)
    List<String> selectCommunityUserIdsByRoleCode(@Param("roleCode") String roleCode);
}
