package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("collection_entry")
public class CollectionEntry {
    @TableId
    private String id;
    private String collectionId;
    private String objectType;
    private String objectId;
    private Integer sortOrder;
    private Instant createdAt;
}
