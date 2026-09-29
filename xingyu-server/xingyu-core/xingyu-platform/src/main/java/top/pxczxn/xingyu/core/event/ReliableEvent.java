package top.pxczxn.xingyu.core.event;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("reliable_event")
public class ReliableEvent {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String eventId;
    private String eventType;
    private String aggregateType;
    private String aggregateId;
    private String payload;
    private String status;
    private Integer attemptCount;
    private Integer maxAttempts;
    private Instant nextAttemptAt;
    private Instant leaseUntil;
    private String lastError;
    private Instant createdAt;
    private Instant updatedAt;
}
