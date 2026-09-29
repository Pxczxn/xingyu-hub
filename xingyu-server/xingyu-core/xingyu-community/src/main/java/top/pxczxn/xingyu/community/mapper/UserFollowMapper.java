package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.UserFollow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserFollowMapper extends BaseMapper<UserFollow> {

    @Select("""
            SELECT * FROM user_follow
            WHERE follower_id = #{followerId} AND followee_id = #{followeeId}
            """)
    UserFollow findByFollowerAndFollowee(String followerId, String followeeId);

    @Delete("""
            DELETE FROM user_follow
            WHERE follower_id = #{followerId} AND followee_id = #{followeeId}
            """)
    int deleteByFollowerAndFollowee(String followerId, String followeeId);

    @Select("""
            SELECT followee_id FROM user_follow
            WHERE follower_id = #{followerId}
            ORDER BY created_at DESC
            """)
    List<String> listFolloweeIdsByFollower(String followerId);

    @Select("""
            SELECT follower_id FROM user_follow
            WHERE followee_id = #{followeeId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<String> listFollowerIdsByFollowee(String followeeId, int limit);

    @Select("SELECT COUNT(*) FROM user_follow WHERE followee_id = #{followeeId}")
    long countFollowers(String followeeId);

    @Select("SELECT COUNT(*) FROM user_follow WHERE follower_id = #{followerId}")
    long countFollowing(String followerId);
}
