package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

@Mapper
public interface CommunitySessionMapper extends BaseMapper<CommunitySession> {

    @Select("SELECT * FROM community_session WHERE token_value = #{tokenValue} LIMIT 1")
    CommunitySession findByTokenValue(String tokenValue);

    @Select("""
            SELECT * FROM community_session
            WHERE user_id = #{userId}
            ORDER BY last_active_at DESC
            """)
    List<CommunitySession> listByUserId(String userId);

    @Update("""
            UPDATE community_session
            SET revoked_at = #{revokedAt}
            WHERE user_id = #{userId}
              AND revoked_at IS NULL
              AND token_value <> #{currentToken}
            """)
    int revokeOtherSessions(
            @Param("userId") String userId,
            @Param("currentToken") String currentToken,
            @Param("revokedAt") Instant revokedAt);

    @Update("""
            UPDATE community_session
            SET revoked_at = #{revokedAt}
            WHERE user_id = #{userId}
              AND revoked_at IS NULL
            """)
    int revokeActiveSessions(@Param("userId") String userId, @Param("revokedAt") Instant revokedAt);
}
