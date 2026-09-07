package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("moment_revision")
public class MomentRevision {
    @TableId
    private String id;
    private String momentId;
    private String body;
    private Integer revisionNumber;
    private Instant createdAt;
}
