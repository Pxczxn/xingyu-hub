package top.pxczxn.xingyu.community.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

import java.time.Instant;

@Mapper
public interface AuthSecurityEventMapper {

    @Insert("""
            INSERT INTO auth_security_event (user_id, event_type, detail, ip_hash, created_at)
            VALUES (#{userId}, #{eventType}, #{detail}, #{ipHash}, #{createdAt})
            """)
    int insert(String userId, String eventType, String detail, String ipHash, Instant createdAt);
}
