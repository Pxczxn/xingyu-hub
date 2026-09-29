package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_event")
public class CommunityEvent {
    @TableId
    private String id;
    private String slug;
    private String title;
    private String body;
    private String status;
    private Instant startsAt;
    private Instant endsAt;
    private Boolean submissionOpen;
    private Instant createdAt;
    private Instant updatedAt;
}
