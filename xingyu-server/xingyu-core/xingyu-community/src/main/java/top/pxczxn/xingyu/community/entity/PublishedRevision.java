package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("published_revision")
public class PublishedRevision {
    @TableId
    private String id;
    private String articleId;
    private String formalRevisionId;
    private Instant publishedAt;
    private String publicationEventId;
}
