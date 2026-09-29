package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("seo_metadata")
public class SeoMetadata {
    @TableId
    private String id;
    private String objectType;
    private String objectId;
    private String title;
    private String description;
    private String canonicalUrl;
    private String ogImageUrl;
    private Instant updatedAt;
}
