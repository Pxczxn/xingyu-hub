package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    /**
     * 某个用户的通知，最新在前。
     *
     * <p>排序键是 {@code created_at DESC, id DESC} 两级。为什么不只用 created_at：
     * 列类型是 {@code timestamp}（秒精度，无小数位），同一秒内产生的多条通知（例如批量写入）
     * 只靠 created_at 无法给出确定顺序 —— MySQL 可以任意返回，翻页/重查会看到"顺序变化"。
     * 补一个 tie-breaker 后顺序是确定的。
     *
     * <p>注意 {@code id} 是 {@code varchar(36)} 的随机 UUID（TokenSupport.newId()），不是
     * 单调 id：它能提供**稳定**但不提供**时序**。同一秒内的顺序仍然是任意的（只是固定），
     * 这一点在此明说，避免被当成"按 id 也是新的在前"。
     */
    @Select("""
            SELECT * FROM notification
            WHERE user_id = #{userId}
            ORDER BY created_at DESC, id DESC
            LIMIT #{limit}
            """)
    List<Notification> listByUserId(String userId, int limit);

    @Select("""
            SELECT COUNT(*) FROM notification
            WHERE user_id = #{userId} AND read_at IS NULL
            """)
    long countUnread(String userId);

    @org.apache.ibatis.annotations.Update("""
            UPDATE notification
            SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = #{userId} AND read_at IS NULL
            """)
    int markAllRead(String userId);
}
