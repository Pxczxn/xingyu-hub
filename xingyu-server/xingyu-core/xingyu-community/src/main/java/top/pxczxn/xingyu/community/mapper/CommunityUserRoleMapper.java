package top.pxczxn.xingyu.community.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;

@Mapper
public interface CommunityUserRoleMapper {

    @Select("""
            SELECT COUNT(*)
            FROM community_user_role
            WHERE community_user_id = #{communityUserId}
              AND role_id = #{roleId}
            """)
    int countByUserAndRole(
            @Param("communityUserId") String communityUserId,
            @Param("roleId") Long roleId);

    @Insert("""
            INSERT INTO community_user_role (id, community_user_id, role_id, created_at)
            VALUES (#{id}, #{communityUserId}, #{roleId}, #{createdAt})
            """)
    int insert(
            @Param("id") String id,
            @Param("communityUserId") String communityUserId,
            @Param("roleId") Long roleId,
            @Param("createdAt") Instant createdAt);
}
