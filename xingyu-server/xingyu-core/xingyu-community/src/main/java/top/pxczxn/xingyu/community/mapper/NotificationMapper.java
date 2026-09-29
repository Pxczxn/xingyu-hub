package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    @Select("""
            SELECT * FROM notification
            WHERE user_id = #{userId}
            ORDER BY created_at DESC
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
