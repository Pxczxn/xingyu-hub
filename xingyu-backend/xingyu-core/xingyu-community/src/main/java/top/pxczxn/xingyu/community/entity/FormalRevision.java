package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("formal_revision")
public class FormalRevision {
    @TableId
    private String id;
    private String articleId;
    private Integer revisionNumber;
    private String title;
    private String summary;
    private String bodyMode;
    private String body;
    private String slug;
    private String visibility;
    private Long sourceDraftLockVersion;
    private Instant frozenAt;
    private Instant createdAt;
}
