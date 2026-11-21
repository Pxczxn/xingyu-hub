package top.pxczxn.xingyu.community.config;

import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import top.pxczxn.xingyu.common.config.PublicBaseUrls;

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

    /**
     * Community web origin for sitemap, RSS, and default canonical URLs.
     * Production YAML defaults this to {@code https://pxczxn.top}.
     */
    private String publicBaseUrl = PublicBaseUrls.DEVELOPMENT_DEFAULT;

    @Autowired(required = false)
    private Environment environment;

    public String normalizedPublicBaseUrl() {
        boolean production = environment != null && environment.acceptsProfiles(Profiles.of("prod"));
        return PublicBaseUrls.resolve(null, publicBaseUrl, production);
    }
}
