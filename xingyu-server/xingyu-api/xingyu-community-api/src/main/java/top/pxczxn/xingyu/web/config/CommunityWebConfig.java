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
                        // 游客首页也是「有 token 就带上身份」的路由：它的 unreadNotifications
                        // 要按会话用户统计（AppLayout 的通知角标就读它），卡片上的 bookmarked
                        // 更是因人而异。漏了它 → 上下文永远为空 → 角标恒为 0、收藏状态恒为未知。
                        // 它同时必须服务游客，所以拦截器把它算作「公开读取」。
                        "/api/v1/home",
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
                        // 话题详情的 following 字段是「因人而异」的读取（关注过的人看到
                        // true）。此前该路由不在拦截器范围，CommunityAuthContext 恒空，
                        // 即使关注成功，GET /topics/{slug} 也永远回报 following=null
                        // （2026-10-10 P0-A 修复的另一半）。该路由只有 GET、面向游客，
                        // 拦截器把它当「公开读取 + 有 token 就带上身份」处理。
                        "/api/v1/topics",
                        "/api/v1/topics/**",
                        "/api/v1/comments",
                        "/api/v1/comments/**",
                        // 书签状态是「因人而异」的读取（同一对象，收藏过的人看到 true），
                        // 所以拦截器必须跑到它上面，否则 CommunityAuthContext 永远是空的。
                        // 该路由同时要服务游客，因此拦截器把它当作「公开读取 + 有 token 就带上身份」。
                        "/api/v1/bookmarks/**",
                        "/api/v1/u/*/follow",
                        "/api/v1/users/*/follow");
    }
}
