package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import top.pxczxn.xingyu.community.entity.CommunityApiToken;

import java.time.Instant;
import java.util.List;

@Mapper
public interface CommunityApiTokenMapper extends BaseMapper<CommunityApiToken> {

    @Select("""
            SELECT * FROM community_api_token
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
            LIMIT #{limit}
            """)
    List<CommunityApiToken> listByUserId(String userId, int limit);

    @Select("""
            SELECT * FROM community_api_token
            WHERE token_hash = #{tokenHash} AND status = 'ACTIVE'
            LIMIT 1
            """)
    CommunityApiToken findActiveByHash(String tokenHash);

    @Update("""
            UPDATE community_api_token
            SET last_used_at = #{usedAt}
            WHERE id = #{id}
            """)
    int touchLastUsed(String id, Instant usedAt);
}
