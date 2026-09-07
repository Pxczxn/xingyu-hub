package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("report_supplement")
public class ReportSupplement {
    @TableId
    private String id;
    private String reportId;
    private String authorId;
    private String body;
    private Instant createdAt;
}
