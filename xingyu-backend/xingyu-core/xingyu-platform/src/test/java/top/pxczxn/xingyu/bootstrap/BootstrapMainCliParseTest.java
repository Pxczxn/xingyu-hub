package top.pxczxn.xingyu.bootstrap;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * BootstrapMain 参数解析逻辑的纯单元测试（不依赖数据库）。
 *
 * <p>覆盖：四种等价调用姿势都解析为 (command=init, profile=prod)；recover / revoke-recovery
 * 同样可解析；空格分隔的 profile 取值；系统属性来源；以及四类 fail-fast 场景
 * （未知参数 / 无业务命令 / 多个业务命令 / profile 缺失）。
 */
class BootstrapMainCliParseTest {

    private static void assertResolves(String[] args, String expectedCommand, String expectedProfile) {
        BootstrapMain.ParsedArgs parsed = BootstrapMain.parseArgs(args);
        assertEquals(expectedCommand, parsed.command(), "业务命令应被正确识别");
        BootstrapMain.ProfileResolution r = BootstrapMain.resolveActiveProfile(parsed.springArgs());
        assertNotNull(r, "profile 必须能从参数中解析出来");
        assertEquals(expectedProfile, r.profile(), "profile 应被正确识别");
    }

    @Test
    void 命令在Spring参数之后() {
        assertResolves(new String[]{"init", "--spring.profiles.active=prod"}, "init", "prod");
    }

    @Test
    void 命令在Spring参数之前() {
        assertResolves(new String[]{"--spring.profiles.active=prod", "init"}, "init", "prod");
    }

    @Test
    void 空格分隔的profile取值也被识别() {
        // Spring 只认 --key=value，本类会把 "--spring.profiles.active" + "prod" 合并成等号形式
        assertResolves(new String[]{"init", "--spring.profiles.active", "prod"}, "init", "prod");
    }

    @Test
    void recover与revokeRecovery命令均可解析() {
        assertResolves(new String[]{"recover", "--spring.profiles.active=prod"}, "recover", "prod");
        assertResolves(new String[]{"revoke-recovery", "--spring.profiles.active=prod"}, "revoke-recovery", "prod");
    }

    @Test
    void 通过系统属性_D_解析profile() {
        String prev = System.setProperty("spring.profiles.active", "prod");
        try {
            BootstrapMain.ParsedArgs parsed = BootstrapMain.parseArgs(new String[]{"init"});
            assertEquals("init", parsed.command());
            BootstrapMain.ProfileResolution r = BootstrapMain.resolveActiveProfile(parsed.springArgs());
            assertNotNull(r);
            assertEquals("prod", r.profile());
            assertEquals("系统属性 -Dspring.profiles.active", r.source());
        } finally {
            if (prev == null) {
                System.clearProperty("spring.profiles.active");
            } else {
                System.setProperty("spring.profiles.active", prev);
            }
        }
    }

    @Test
    void 未识别到业务命令时failFast() {
        BootstrapMain.BootstrapCliException ex = assertThrows(
                BootstrapMain.BootstrapCliException.class,
                () -> BootstrapMain.parseArgs(new String[]{"--spring.profiles.active=prod"}));
        org.junit.jupiter.api.Assertions.assertTrue(
                ex.getMessage().contains("未识别到业务命令") || ex.getMessage().contains("no business command"));
    }

    @Test
    void 出现多个业务命令时failFast() {
        assertThrows(BootstrapMain.BootstrapCliException.class,
                () -> BootstrapMain.parseArgs(new String[]{"init", "recover", "--spring.profiles.active=prod"}));
    }

    @Test
    void 出现未知非Spring参数时failFast() {
        // "foo" 既不是业务命令也不是以 --/-D 开头的 Spring 参数 -> 必须报错
        assertThrows(BootstrapMain.BootstrapCliException.class,
                () -> BootstrapMain.parseArgs(new String[]{"init", "--spring.profiles.active=prod", "foo"}));
    }

    @Test
    void profile缺失时resolveActiveProfile返回null() {
        BootstrapMain.ParsedArgs parsed = BootstrapMain.parseArgs(new String[]{"init"});
        assertNull(BootstrapMain.resolveActiveProfile(parsed.springArgs()),
                "没有任何 profile 来源时应返回 null（由 main 在启动前 fail-fast 退出）");
    }
}
