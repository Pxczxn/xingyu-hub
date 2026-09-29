package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("event_submission")
public class EventSubmission {
    @TableId
    private String id;
    private String eventId;
    private String authorId;
    private String objectType;
    private String objectId;
    private String note;
    private String status;
    private Instant createdAt;
}
