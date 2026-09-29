package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("event_registration")
public class EventRegistration {
    @TableId
    private String id;
    private String eventId;
    private String userId;
    private String status;
    private Instant createdAt;
    private Instant cancelledAt;
}
