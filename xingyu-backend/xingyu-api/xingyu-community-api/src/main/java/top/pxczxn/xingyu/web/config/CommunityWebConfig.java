package top.pxczxn.xingyu.web.config;

import top.pxczxn.xingyu.web.interceptor.CommunityAuthInterceptor;
import top.pxczxn.xingyu.web.interceptor.CommunityOpenApiInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class CommunityWebConfig implements WebMvcConfigurer {

    private final CommunityAuthInterceptor communityAuthInterceptor;
    private final CommunityOpenApiInterceptor communityOpenApiInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(communityOpenApiInterceptor)
                .addPathPatterns("/api/v1/open", "/api/v1/open/**");
        registry.addInterceptor(communityAuthInterceptor)
                .addPathPatterns(
                        "/api/v1/me",
                        "/api/v1/me/**",
                        "/api/v1/auth/re-authenticate",
                        "/api/v1/notifications",
                        "/api/v1/notifications/**",
                        "/api/v1/messages",
                        "/api/v1/messages/**",
                        "/api/v1/reports",
                        "/api/v1/reports/**",
                        "/api/v1/appeals",
                        "/api/v1/appeals/**",
                        "/api/v1/moments",
                        "/api/v1/moments/**",
                        "/api/v1/likes/**",
                        "/api/v1/follows/**",
                        "/api/v1/comments",
                        "/api/v1/comments/**",
                        "/api/v1/users/*/follow");
    }
}
