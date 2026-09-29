package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("article_topic")
public class ArticleTopic {
    private String articleId;
    private String topicId;
    private Instant createdAt;
}
