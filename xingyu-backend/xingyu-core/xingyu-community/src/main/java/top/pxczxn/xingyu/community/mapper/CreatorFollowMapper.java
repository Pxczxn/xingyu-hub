package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CreatorFollow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CreatorFollowMapper extends BaseMapper<CreatorFollow> {

    @Select("""
            SELECT * FROM creator_follow
            WHERE follower_id = #{followerId} AND creator_id = #{creatorId}
            """)
    CreatorFollow findByFollowerAndCreator(String followerId, String creatorId);

    @Delete("""
            DELETE FROM creator_follow
            WHERE follower_id = #{followerId} AND creator_id = #{creatorId}
            """)
    int deleteByFollowerAndCreator(String followerId, String creatorId);

    @Select("""
            SELECT creator_id FROM creator_follow
            WHERE follower_id = #{followerId}
            ORDER BY created_at DESC
            """)
    List<String> listCreatorIdsByFollower(String followerId);

    @Select("""
            SELECT follower_id FROM creator_follow
            WHERE creator_id = #{creatorId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<String> listFollowerIdsByCreator(String creatorId, int limit);

    @Select("SELECT COUNT(*) FROM creator_follow WHERE creator_id = #{creatorId}")
    long countFollowers(String creatorId);

    @Select("SELECT COUNT(*) FROM creator_follow WHERE follower_id = #{followerId}")
    long countFollowing(String followerId);
}
