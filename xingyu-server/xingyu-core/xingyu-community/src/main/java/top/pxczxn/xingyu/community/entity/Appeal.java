package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("appeal")
public class Appeal {
    @TableId
    private String id;
    private String caseId;
    private String appellantId;
    private String body;
    private String status;
    private Instant createdAt;
}
