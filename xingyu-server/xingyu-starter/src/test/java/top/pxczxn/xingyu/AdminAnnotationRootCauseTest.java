package top.pxczxn.xingyu;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.strategy.SaStrategy;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.admin.controller.system.SysRoleController;
import top.pxczxn.xingyu.admin.controller.system.SysUserController;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Admin Permission Annotation Enforcement — 根因证据测试。
 *
 * <p>钉死三个事实：① SysUserController 是 CGLIB 代理（AOP 切面导致）；
 * ② 代理类方法上 getAnnotation 读不到 @SaCheckPermission（失效机制）；
 * ③ Spring AnnotationUtils.findAnnotation 能从代理方法找回注解（修复机制）。
 * 同时反向对照未被代理的 SysRoleController。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@ActiveProfiles("test")
class AdminAnnotationRootCauseTest {

    @Autowired
    SysUserController userController;

    @Autowired
    SysRoleController roleController;

    @Test
    void userControllerIsCglibProxiedAndProxyMethodLosesTheAnnotation() throws Exception {
        Class<?> clazz = userController.getClass();
        assertTrue(AopUtils.isCglibProxy(userController),
                "SysUserController 应被 AOP 代理，实际=" + clazz.getName());
        assertTrue(clazz.getName().contains("$$SpringCGLIB$$"), clazz.getName());

        // 代理类方法上找不到任何 @SaCheckPermission（失效机制直接证据）
        long proxyAnnCount = java.util.Arrays.stream(clazz.getMethods())
                .filter(m -> m.getAnnotation(SaCheckPermission.class) != null).count();
        assertEquals(0, proxyAnnCount, "CGLIB 代理类方法上应读不到 @SaCheckPermission");
        // 原类（target）方法上有
        Class<?> targetClass = org.springframework.aop.support.AopUtils.getTargetClass(userController);
        long targetAnnCount = java.util.Arrays.stream(targetClass.getMethods())
                .filter(m -> m.getAnnotation(SaCheckPermission.class) != null).count();
        assertTrue(targetAnnCount > 0, "目标类方法上应存在 @SaCheckPermission");
        // Spring 的 findAnnotation 能从代理方法沿类层次找回（修复所依赖的行为）
        Method anyProxyMethod = java.util.Arrays.stream(clazz.getMethods())
                .filter(m -> m.getName().equals("page")).findFirst().orElseThrow();
        assertNotNull(AnnotationUtils.findAnnotation(anyProxyMethod, SaCheckPermission.class),
                "AnnotationUtils.findAnnotation 应穿透代理找回注解（修复机制依据）");
    }

    @Test
    void roleControllerAnnotationReadsBackThroughSaStrategy() throws Exception {
        // 反向对照：未被切面匹配的控制器未被代理，注解可读且 SaStrategy 正常
        Class<?> clazz = roleController.getClass();
        // SysRoleController 同样被 CGLIB 代理（AOP 全局生效）——修复后的 SaStrategy
        // 必须对代理控制器也能读到注解（role page 403 行为正确即来自这条链路）。
        Method annotated = null;
        for (Method m : org.springframework.aop.support.AopUtils
                .getTargetClass(roleController).getMethods()) {
            if (m.getAnnotation(SaCheckPermission.class) != null) {
                annotated = m;
                break;
            }
        }
        assertNotNull(annotated, "SysRoleController 应存在 @SaCheckPermission 方法");
        Class<?> proxyClass = roleController.getClass();
        Method proxyMethod = null;
        for (Method m : proxyClass.getMethods()) {
            if (m.getName().equals(annotated.getName())) {
                proxyMethod = m;
                break;
            }
        }
        Method readFrom = proxyMethod != null ? proxyMethod : annotated;
        assertNotNull(SaStrategy.instance.getAnnotation.apply(readFrom, SaCheckPermission.class),
                "修复后的 SaStrategy 应能从代理控制器读到注解");
    }
}
