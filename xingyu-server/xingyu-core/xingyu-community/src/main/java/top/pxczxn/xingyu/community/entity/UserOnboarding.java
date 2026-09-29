package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("user_onboarding")
public class UserOnboarding {
    @TableId
    private String userId;
    private String step;
    private String interestsJson;
    private Integer completed;
    private Instant updatedAt;
}
