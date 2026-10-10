package top.pxczxn.xingyu.system.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.router.SaRouter;
import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.strategy.SaStrategy;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Sa-Token配置
 */
@Configuration
public class SaTokenConfig implements WebMvcConfigurer {

    /*
     * 注解读取修复（Admin Permission Annotation Enforcement Recovery，2026-10-10）。
     *
     * 背景：admin 控制器被项目 AOP 切面（LogAspect/@Log、RepeatSubmitAspect）CGLIB
     * 代理，而 sa-token 1.37 默认用 method.getAnnotation(...) 从 HandlerMethod 的
     * 【代理类方法】读注解 —— CGLIB 子类方法不继承方法注解，读取结果恒为 null，
     * 导致全 admin-api 130 处 @SaCheckPermission 静默失效（隔离实测：role=user 账号
     * 通过 sys:user:list 保护的端点并真实发布文章）。
     *
     * 修复：把 SaStrategy 的注解读取换成 Spring 的 AnnotationUtils.findAnnotation ——
     * 它会在方法所属类层次（含 CGLIB 超类/桥接方法）上查找注解。仅替换注解【读取】，
     * 校验逻辑（checkElementAnnotation）与权限数据源（StpInterfaceImpl → role_menu →
     * sys_menu.permission）全部保持原样：不引入第二套权限模型，保留细粒度编码
     * （sys:user:list/add/edit/delete 等），也不影响 @SaIgnore / @SaCheckLogin 等其它注解。
     */
    static {
        SaStrategy.instance.getAnnotation = (element, annotationClass) -> {
            if (element instanceof java.lang.reflect.Method method) {
                return org.springframework.core.annotation.AnnotationUtils
                        .findAnnotation(method, annotationClass);
            }
            return annotationClass.isInstance(element) ? annotationClass.cast(element) : null;
        };
    }

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
            // 社区治理域必须持有 admin 角色（Admin Security Gate Recovery，2026-10-10）。
            //
            // 背景：controller 被 AOP（@Log/@RepeatSubmit 切面）CGLIB 代理后，代理类方法
            // 丢失 @SaCheckPermission 注解，SaInterceptor 的注解鉴权对整个 admin-api 静默
            // 失效（隔离环境实测：role=user 账号通过 sys:user:list 与审核 decide 并真实
            // 发布文章）。因此这里用【运行时路由断言】而非注解保护社区治理面——不依赖
            // 注解读取，天然免疫代理丢注解问题，且复用现有 sys_role 体系（code=admin）。
            //
            // 覆盖核对（对照 controller/community 下全部 14 个 @RequestMapping）：
            //   /community/**（users/events/featured/galaxies/guide-pages/search-index）
            //   /review/**、/moderation/**、/topics/**
            //   /operations/**（overview/announcements/groups/content/events…）
            // 全部落入以下 5 组模式；/sys/**、/monitor/**、/log/**、/file/**、/tool/**
            // 等系统域不匹配，不受影响（其注解失效问题另行裁决，见审计报告）。
            SaRouter.match(
                    "/api/v1/admin/community/**",
                    "/api/v1/admin/review/**",
                    "/api/v1/admin/moderation/**",
                    "/api/v1/admin/topics/**",
                    "/api/v1/admin/operations/**"
            ).check(r -> StpUtil.checkRole("admin"));
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
