package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("registration_idempotency")
public class RegistrationIdempotency {
    @TableId
    private String qualifiedKey;
    private String payloadHash;
    private String responseJson;
    private Instant createdAt;
}
