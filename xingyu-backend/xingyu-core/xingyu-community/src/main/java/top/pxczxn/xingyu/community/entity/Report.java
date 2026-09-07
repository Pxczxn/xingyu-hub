package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("report")
public class Report {
    @TableId
    private String id;
    private String reporterId;
    private String objectType;
    private String objectId;
    private String reason;
    private String detail;
    private String status;
    private Instant createdAt;
}
