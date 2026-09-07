package top.pxczxn.xingyu.system.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.router.SaRouter;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Sa-Token配置
 */
@Configuration
public class SaTokenConfig implements WebMvcConfigurer {

    /**
     * 注册Sa-Token拦截器
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SaInterceptor(handler -> {
            SaRouter.match("/api/v1/admin/**")
                    .notMatch(
                            "/api/v1/admin/auth/login",
                            "/api/v1/admin/auth/register",
                            "/api/v1/admin/auth/captcha",
                            "/api/v1/admin/auth/sms-code",
                            "/api/v1/admin/crypto/**",
                            "/api/v1/admin/sys/config-group/public",
                            "/api/v1/admin/sys/user/template",
                            "/api/v1/admin/sys/file/preview/**",
                            "/api/v1/admin/sys/file/download/**",
                            "/api/v1/admin/file/**",
                            "/api/v1/admin/files/**"
                    )
                    .check(r -> StpUtil.checkLogin());
            SaRouter.match("/api/v1/app/auth/**")
                    .notMatch(
                            "/api/v1/app/auth/login",
                            "/api/v1/app/auth/sms-code"
                    )
                    .check(r -> StpUtil.checkLogin());
            SaRouter.match("/api/v1/auth/**")
                    .notMatch(
                            "/api/v1/auth/login",
                            "/api/v1/auth/register",
                            "/api/v1/auth/captcha",
                            "/api/v1/auth/sms/register",
                            "/api/v1/auth/logout",
                            "/api/v1/auth/re-authenticate",
                            "/api/v1/auth/email/verify",
                            "/api/v1/auth/email/resend",
                            "/api/v1/auth/password-recovery",
                            "/api/v1/auth/password-reset"
                    )
                    .check(r -> StpUtil.checkLogin());
        })).addPathPatterns("/api/v1/admin/**", "/api/v1/app/**", "/api/v1/auth/**");
    }

    /**
     * 跨域配置
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .exposedHeaders("satoken")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
