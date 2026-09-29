package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.entity.EventRegistration;

@Mapper
public interface EventRegistrationMapper extends BaseMapper<EventRegistration> {

    @Select("""
            SELECT * FROM event_registration
            WHERE event_id = #{eventId} AND user_id = #{userId}
            LIMIT 1
            """)
    EventRegistration findByEventAndUser(String eventId, String userId);

    @Select("""
            SELECT COUNT(*) FROM event_registration
            WHERE event_id = #{eventId} AND status = 'REGISTERED'
            """)
    long countRegistered(String eventId);
}
