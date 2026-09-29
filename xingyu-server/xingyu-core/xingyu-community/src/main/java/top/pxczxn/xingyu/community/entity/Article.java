package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("article")
public class Article {
    @TableId
    private String id;
    private String spaceId;
    private String ownerId;
    private String categoryId;
    /** 编辑工作流：DRAFT / IN_REVIEW / PUBLISHED */
    private String status;
    /** 生命周期：ACTIVE / TRASHED */
    private String lifecycleStatus;
    /** 平台治理：NORMAL / HIDDEN / FROZEN */
    private String moderationStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
