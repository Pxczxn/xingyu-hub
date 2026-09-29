package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("content_tag")
public class ContentTag {
    @TableId
    private String id;
    private String slug;
    private String name;
    private String normalizedName;
}
