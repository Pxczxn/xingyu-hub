package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("topic")
public class Topic {
    @TableId
    private String id;
    private String seedKey;
    private String slug;
    private String name;
    private String description;
    private String parentTopicId;
    private String status;
}
