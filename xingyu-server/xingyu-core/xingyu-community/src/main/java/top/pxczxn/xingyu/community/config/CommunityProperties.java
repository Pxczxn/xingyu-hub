package top.pxczxn.xingyu.community.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "xingyu.community")
public class CommunityProperties {

    /** 评论可编辑窗口（秒），默认 15 分钟 */
    private long commentEditWindowSeconds = 900;

    /** 动态可编辑窗口（秒），默认 30 分钟 */
    private long momentEditWindowSeconds = 1800;

    /** 消息可撤回窗口（秒），默认 2 分钟 */
    private long messageRecallWindowSeconds = 120;
}
