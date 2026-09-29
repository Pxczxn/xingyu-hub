package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.UserBlock;

import java.util.List;

@Mapper
public interface UserBlockMapper extends BaseMapper<UserBlock> {

    @Select("""
            SELECT * FROM user_block
            WHERE blocker_id = #{blockerId} AND blocked_id = #{blockedId}
            LIMIT 1
            """)
    UserBlock findByPair(String blockerId, String blockedId);

    @Select("""
            SELECT * FROM user_block
            WHERE blocker_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<UserBlock> listByBlocker(String userId, int limit);

    @Select("""
            SELECT COUNT(*) FROM user_block
            WHERE (blocker_id = #{userId} AND blocked_id = #{otherId})
               OR (blocker_id = #{otherId} AND blocked_id = #{userId})
            """)
    int countBlockBetween(String userId, String otherId);
}
