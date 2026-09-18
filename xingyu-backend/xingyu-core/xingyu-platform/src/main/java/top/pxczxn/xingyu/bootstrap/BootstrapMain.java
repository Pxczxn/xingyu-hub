package top.pxczxn.xingyu.bootstrap;

import top.pxczxn.xingyu.core.bootstrap.BootstrapService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 生产/目标环境初始化 CLI（不启动 Web 容器）。
 *
 * <p><b>必须显式指定 Spring profile</b>：本工具会写入目标库的 {@code sys_user}、
 * {@code admin_account}、{@code bootstrap_state} 等表，一旦静默回退到 {@code dev}
 * 就会误连本地开发库并改写开发数据。因此这里<b>不提供任何默认 profile</b>：
 * 未显式指定时，在<b>接触数据库之前</b>直接 fail-fast 退出。
 *
 * <p>profile 只需按 Spring 标准方式提供其一即可（本类不再调用 setAdditionalProfiles，
 * 以免与调用方显式传入的值叠加冲突）：
 * <pre>
 *   SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter.jar init
 *   java -jar xingyu-starter.jar --spring.profiles.active=prod init
 *   java -Dspring.profiles.active=prod -jar xingyu-starter.jar init
 * </pre>
 */
@SpringBootApplication(scanBasePackages = "top.pxczxn.xingyu")
public class BootstrapMain {

    private static final Pattern PROFILE_ARG =
            Pattern.compile("^(?:--|-D)?spring\\.profiles\\.active[= ](.+)$");

    /** 未指定 profile 时的退出码：与"命令不存在"(1) / "执行中异常"区分开。 */
    private static final int EXIT_PROFILE_MISSING = 2;

    public static void main(String[] args) {
        if (args.length == 0) {
            printUsage();
            System.exit(1);
        }

        // 启动前校验：确保不会在未指定 profile 的情况下连到意外的库
        ProfileResolution resolved = resolveActiveProfile(args);
        if (resolved == null) {
            System.err.println("❌ Bootstrap CLI 拒绝启动：未显式指定 Spring profile。");
            System.err.println("   本工具会写入目标库的 sys_user / admin_account / bootstrap_state，");
            System.err.println("   未指定 profile 时不会回退到 dev（否则会误连本地开发库并改写开发数据）。");
            System.err.println("   请任选一种方式显式指定：");
            System.err.println("     SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter.jar " + args[0]);
            System.err.println("     java -jar xingyu-starter.jar --spring.profiles.active=prod " + args[0]);
            System.err.println("     java -Dspring.profiles.active=prod -jar xingyu-starter.jar " + args[0]);
            System.exit(EXIT_PROFILE_MISSING);
        }
        System.out.println("Bootstrap CLI : command=" + args[0]
                + ", profile=" + resolved.profile() + "（来源：" + resolved.source() + "）");

        SpringApplication app = new SpringApplication(BootstrapMain.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        ConfigurableApplicationContext context = app.run(args);
        BootstrapService service = context.getBean(BootstrapService.class);
        switch (args[0]) {
            case "init" -> service.init();
            case "recover" -> service.recover();
            case "revoke-recovery" -> service.revokeRecovery();
            default -> throw new IllegalArgumentException("unknown command: " + args[0]);
        }
        SpringApplication.exit(context);
    }

    private record ProfileResolution(String profile, String source) {}

    /** 解析调用方显式指定的 profile；没有任何来源时返回 null（由调用方 fail-fast）。 */
    private static ProfileResolution resolveActiveProfile(String[] args) {
        for (String arg : args) {
            Matcher m = PROFILE_ARG.matcher(arg);
            if (m.matches()) {
                String value = m.group(1).trim();
                if (!value.isEmpty()) {
                    return new ProfileResolution(value, "命令行参数");
                }
            }
        }
        String env = System.getenv("SPRING_PROFILES_ACTIVE");
        if (env != null && !env.isBlank()) {
            return new ProfileResolution(env.trim(), "环境变量 SPRING_PROFILES_ACTIVE");
        }
        String sysProp = System.getProperty("spring.profiles.active");
        if (sysProp != null && !sysProp.isBlank()) {
            return new ProfileResolution(sysProp.trim(), "系统属性 -Dspring.profiles.active");
        }
        return null;
    }

    private static void printUsage() {
        System.err.println("usage: <profile 必须显式指定> init | recover | revoke-recovery");
        System.err.println("  SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter.jar init");
        System.err.println("  java -jar xingyu-starter.jar --spring.profiles.active=prod init");
        System.err.println();
        System.err.println("required env:");
        System.err.println("  XINGYU_DEPLOY_SECRET        首次运行会写入 system_parameter，之后必须一致");
        System.err.println("  XINGYU_BOOTSTRAP_PASSWORD   将写入 sys_user / admin_account 的强口令");
        System.err.println("  XINGYU_BOOTSTRAP_USERNAME   可选，默认 admin");
        System.err.println("  XINGYU_RECOVERY_REASON      recover 命令必填");
    }
}
