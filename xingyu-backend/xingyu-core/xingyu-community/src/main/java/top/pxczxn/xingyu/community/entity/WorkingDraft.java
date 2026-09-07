package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("working_draft")
public class WorkingDraft {
    @TableId
    private String id;
    private String articleId;
    private String title;
    private String summary;
    private String bodyMode;
    private String body;
    private String slug;
    private String visibility;
    private Long lockVersion;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant scheduledPublishAt;
}
