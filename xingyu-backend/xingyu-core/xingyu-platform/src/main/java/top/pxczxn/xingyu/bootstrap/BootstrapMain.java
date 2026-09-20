package top.pxczxn.xingyu.bootstrap;

import top.pxczxn.xingyu.core.bootstrap.BootstrapService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 生产/目标环境初始化 CLI（不启动 Web 容器）。
 *
 * <p><b>业务命令</b>（{@code init} / {@code recover} / {@code revoke-recovery}）与
 * <b>Spring 参数</b>（{@code --spring.profiles.active=prod} 等）可以任意顺序混排：
 * 本类会先把两者分离，业务命令取唯一的一个，其余以 {@code --} 开头的原样交给 Spring。
 *
 * <p><b>必须显式指定 Spring profile</b>：本工具会写入目标库的 {@code sys_user}、
 * {@code admin_account}、{@code bootstrap_state} 等表，一旦静默回退到 {@code dev}
 * 就会误连本地开发库并改写开发数据。因此这里<b>不提供任何默认 profile</b>：
 * 未显式指定时，在<b>接触数据库之前</b>直接 fail-fast 退出。
 *
 * <p>以下调用方式等价（均会执行 {@code init}）：
 * <pre>
 *   java -jar xingyu-starter-1.0.0.jar init --spring.profiles.active=prod
 *   java -jar xingyu-starter-1.0.0.jar --spring.profiles.active=prod init
 *   SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter-1.0.0.jar init
 *   java -Dspring.profiles.active=prod -jar xingyu-starter-1.0.0.jar init
 * </pre>
 */
@SpringBootApplication(scanBasePackages = "top.pxczxn.xingyu")
public class BootstrapMain {

    private static final Set<String> COMMANDS = Set.of("init", "recover", "revoke-recovery");

    /** 只对该参数允许"空格分隔的取值"（--spring.profiles.active prod），避免误吞后续命令。 */
    private static final String PROFILE_FLAG = "--spring.profiles.active";

    private static final Pattern PROFILE_ARG =
            Pattern.compile("^(?:--|-D)?spring\\.profiles\\.active[= ](.+)$");

    /** profile 缺失时的退出码：与"参数错误"(1) / "执行中异常"区分开。 */
    private static final int EXIT_PROFILE_MISSING = 2;

    public static void main(String[] args) {
        try {
            ParsedArgs parsed = parseArgs(args);   // 参数错误 → 抛 BootstrapCliException（下方捕获后 exit 1）
            String command = parsed.command();

            // 启动前校验：确保不会在未指定 profile 的情况下连到意外的库
            ProfileResolution resolved = resolveActiveProfile(parsed.springArgs());
            if (resolved == null) {
                System.err.println("❌ Bootstrap CLI 拒绝启动：未显式指定 Spring profile。");
                System.err.println("   本工具会写入目标库的 sys_user / admin_account / bootstrap_state，");
                System.err.println("   未指定 profile 时不会回退到 dev（否则会误连本地开发库并改写开发数据）。");
                System.err.println("   请任选一种方式显式指定：");
                System.err.println("     SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter-1.0.0.jar " + command);
                System.err.println("     java -jar xingyu-starter-1.0.0.jar " + command
                        + " --spring.profiles.active=prod");
                System.err.println("     java -jar xingyu-starter-1.0.0.jar --spring.profiles.active=prod "
                        + command);
                System.err.println("     java -Dspring.profiles.active=prod -jar xingyu-starter-1.0.0.jar "
                        + command);
                System.exit(EXIT_PROFILE_MISSING);
            }
            System.out.println("Bootstrap CLI : command=" + command
                    + ", profile=" + resolved.profile() + "（来源：" + resolved.source() + "）");

            SpringApplication app = new SpringApplication(BootstrapMain.class);
            app.setWebApplicationType(WebApplicationType.NONE);
            ConfigurableApplicationContext context = app.run(args);
            BootstrapService service = context.getBean(BootstrapService.class);
            switch (command) {
                case "init" -> service.init();
                case "recover" -> service.recover();
                case "revoke-recovery" -> service.revokeRecovery();
                default -> throw new IllegalStateException("unknown command: " + command);
            }
            SpringApplication.exit(context);
        } catch (BootstrapCliException e) {
            // 参数错误：parseArgs 已打印明确错误与 usage，这里仅以专用退出码退出
            System.exit(1);
        }
    }

    /** 解析过程中发现的参数错误：main 捕获后退出码 1（与 profile 缺失的 2 区分）。 */
    static final class BootstrapCliException extends RuntimeException {
        BootstrapCliException(String message) {
            super(message);
        }
    }

    /**
     * 分离业务命令与 Spring 参数。业务命令必须恰好出现一次；任何既不是业务命令、
     * 也不属于 Spring 参数的 token 都视为错误（不给"静默忽略"的机会）。
     */
    static ParsedArgs parseArgs(String[] args) {
        List<String> commands = new ArrayList<>();
        List<String> springArgs = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        boolean pendingProfileValue = false;

        for (String arg : args) {
            if (pendingProfileValue) {
                pendingProfileValue = false;
                boolean isNextFlag = arg.startsWith("--") || arg.startsWith("-D");
                if (isNextFlag) {
                    // 空格形式的 profile 没有取到值（下一个还是 flag）：当作独立 spring 参数处理
                    springArgs.add(arg);
                    pendingProfileValue = arg.equals(PROFILE_FLAG);
                    continue;
                }
                // 把 "--spring.profiles.active" + "<value>" 合并成 "--spring.profiles.active=<value>"，
                // 既便于本类解析，也保证原样交给 Spring 时 Spring 仍能正确识别 profile
                // （Spring 仅认 --key=value 形式，不认 "--key value" 空格分隔）
                int last = springArgs.size() - 1;
                springArgs.set(last, springArgs.get(last) + "=" + arg);
                continue;
            }
            if (arg.startsWith("--") || arg.startsWith("-D")) {
                springArgs.add(arg);
                pendingProfileValue = arg.equals(PROFILE_FLAG);
                continue;
            }
            if (COMMANDS.contains(arg)) {
                commands.add(arg);
                continue;
            }
            unknown.add(arg);
        }

        if (!unknown.isEmpty()) {
            System.err.println("❌ Bootstrap CLI 参数错误：出现无法识别的参数 -> " + String.join(", ", unknown));
            System.err.println("   允许的业务命令：" + String.join(" | ", COMMANDS));
            System.err.println("   Spring 参数需以 -- 开头（例如 --spring.profiles.active=prod）。");
            printUsage();
            throw new BootstrapCliException("unknown argument: " + String.join(", ", unknown));
        }
        if (commands.isEmpty()) {
            System.err.println("❌ Bootstrap CLI 参数错误：未识别到业务命令。");
            printUsage();
            throw new BootstrapCliException("no business command");
        }
        if (commands.size() > 1) {
            System.err.println("❌ Bootstrap CLI 参数错误：出现多个业务命令 -> "
                    + String.join(", ", new LinkedHashSet<>(commands)) + "（一次只能执行一个）。");
            printUsage();
            throw new BootstrapCliException("multiple commands: " + String.join(", ", new LinkedHashSet<>(commands)));
        }
        return new ParsedArgs(commands.get(0), springArgs);
    }

    /** 解析调用方显式指定的 profile；没有任何来源时返回 null（由调用方 fail-fast）。 */
    static ProfileResolution resolveActiveProfile(List<String> springArgs) {
        for (String arg : springArgs) {
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
        System.err.println("usage: <业务命令> [--spring 参数...]（顺序不限，但 profile 必须显式指定）");
        System.err.println("  业务命令（一次只能一个）：init | recover | revoke-recovery");
        System.err.println("  示例（以下四种等价，均执行 init）：");
        System.err.println("    java -jar xingyu-starter-1.0.0.jar init --spring.profiles.active=prod");
        System.err.println("    java -jar xingyu-starter-1.0.0.jar --spring.profiles.active=prod init");
        System.err.println("    SPRING_PROFILES_ACTIVE=prod java -jar xingyu-starter-1.0.0.jar init");
        System.err.println("    java -Dspring.profiles.active=prod -jar xingyu-starter-1.0.0.jar init");
        System.err.println();
        System.err.println("required env:");
        System.err.println("  XINGYU_DEPLOY_SECRET        首次运行会写入 system_parameter，之后必须一致");
        System.err.println("  XINGYU_BOOTSTRAP_PASSWORD   将写入 sys_user / admin_account 的强口令");
        System.err.println("  XINGYU_BOOTSTRAP_USERNAME   可选，默认 admin");
        System.err.println("  XINGYU_RECOVERY_REASON      recover 命令必填");
    }

    record ParsedArgs(String command, List<String> springArgs) {}

    record ProfileResolution(String profile, String source) {}
}
