package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.RecentAuthentication;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;

@Mapper
public interface RecentAuthenticationMapper extends BaseMapper<RecentAuthentication> {

    @Select("""
            SELECT * FROM recent_authentication
            WHERE id = #{id} AND user_id = #{userId} AND session_id = #{sessionId}
            LIMIT 1
            """)
    RecentAuthentication findByIdAndUserAndSession(String id, String userId, String sessionId);

    /**
     * 原子地把一条<b>未消费且未过期</b>的 grant 标记为已消费（2026-10-08 新增）。
     *
     * <p>防重放的关键在这里，而不是应用层的「先查后写」：两个并发请求（同一 grant id）
     * 都可能查到 {@code consumed_at IS NULL}，然后都通过校验。只有把
     * {@code consumed_at} 从 NULL 改成非 NULL 的那一个会返回 1，另一个返回 0。
     *
     * <p>{@code expires_at > #{now}} 一并写进 WHERE：让过期 grant 在数据库层就消费不掉，
     * 不给应用层时钟偏差留下可乘之机。
     *
     * @return 1 = 本请求赢得了这次消费；0 = 已被并发请求消费 / 已过期 / 不存在
     */
    @Update("""
            UPDATE recent_authentication
            SET consumed_at = #{now}
            WHERE id = #{id}
              AND user_id = #{userId}
              AND session_id = #{sessionId}
              AND consumed_at IS NULL
              AND expires_at > #{now}
            """)
    int consumeOnce(@Param("id") String id, @Param("userId") String userId,
            @Param("sessionId") String sessionId, @Param("now") Instant now);
}
