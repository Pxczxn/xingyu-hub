package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("search_document")
public class SearchDocument {
    @TableId
    private String id;
    private String objectType;
    private String objectId;
    private String title;
    private String summary;
    private Long discoveryVersion;
    private Instant indexedAt;
    private Instant removedAt;
}
