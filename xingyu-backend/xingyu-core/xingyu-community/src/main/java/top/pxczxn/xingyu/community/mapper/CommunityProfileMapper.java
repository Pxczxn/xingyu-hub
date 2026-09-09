package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CommunityProfileMapper extends BaseMapper<CommunityProfile> {

    @Select("SELECT * FROM community_profile WHERE LOWER(username) = LOWER(#{username}) LIMIT 1")
    CommunityProfile findByUsername(String username);

    @Select("SELECT * FROM community_profile WHERE user_id = #{userId} LIMIT 1")
    CommunityProfile findByUserId(String userId);

    @Select("""
            SELECT * FROM community_profile
            WHERE user_id != #{excludeUserId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityProfile> listSuggested(String excludeUserId, int limit);

    @Select("""
            SELECT cp.* FROM community_profile cp
            INNER JOIN community_user cu ON cu.id = cp.user_id
            WHERE cu.status = 'ACTIVE'
              AND (
                LOWER(cp.username) LIKE CONCAT('%', LOWER(#{query}), '%')
                OR LOWER(COALESCE(cp.display_name, '')) LIKE CONCAT('%', LOWER(#{query}), '%')
                OR EXISTS (
                  SELECT 1 FROM username_history uh
                  WHERE uh.user_id = cp.user_id
                    AND LOWER(uh.username) LIKE CONCAT('%', LOWER(#{query}), '%')
                )
              )
              AND (
                cp.visibility = 'PUBLIC'
                OR LOWER(cp.username) = LOWER(TRIM(#{query}))
                OR EXISTS (
                  SELECT 1 FROM username_history uh2
                  WHERE uh2.user_id = cp.user_id
                    AND LOWER(uh2.username) = LOWER(TRIM(#{query}))
                )
              )
            ORDER BY
              CASE WHEN LOWER(cp.username) = LOWER(TRIM(#{query})) THEN 0 ELSE 1 END,
              cp.created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityProfile> searchDiscoverableByLatest(String query, int limit);

    @Select("""
            SELECT cp.* FROM community_profile cp
            INNER JOIN community_user cu ON cu.id = cp.user_id
            LEFT JOIN (
              SELECT followee_id, COUNT(*) AS follower_count
              FROM user_follow
              GROUP BY followee_id
            ) fc ON fc.followee_id = cp.user_id
            WHERE cu.status = 'ACTIVE'
              AND (
                LOWER(cp.username) LIKE CONCAT('%', LOWER(#{query}), '%')
                OR LOWER(COALESCE(cp.display_name, '')) LIKE CONCAT('%', LOWER(#{query}), '%')
                OR EXISTS (
                  SELECT 1 FROM username_history uh
                  WHERE uh.user_id = cp.user_id
                    AND LOWER(uh.username) LIKE CONCAT('%', LOWER(#{query}), '%')
                )
              )
              AND (
                cp.visibility = 'PUBLIC'
                OR LOWER(cp.username) = LOWER(TRIM(#{query}))
                OR EXISTS (
                  SELECT 1 FROM username_history uh2
                  WHERE uh2.user_id = cp.user_id
                    AND LOWER(uh2.username) = LOWER(TRIM(#{query}))
                )
              )
            ORDER BY
              CASE WHEN LOWER(cp.username) = LOWER(TRIM(#{query})) THEN 0 ELSE 1 END,
              COALESCE(fc.follower_count, 0) DESC,
              cp.created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityProfile> searchDiscoverableByHot(String query, int limit);
}
