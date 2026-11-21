package top.pxczxn.xingyu.core.security;

import cn.hutool.crypto.digest.BCrypt;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;

/**
 * 生产环境默认口令启动守卫。
 *
 * <p>迁移基线（{@code sql/V001__mars_base_schema_and_seed.sql}）为了保留可复现的历史迁移链，
 * 种子数据里保留了 Mars 原始的 {@code admin} 账号及其<b>已知默认口令</b>（admin123）。
 * 这在开发/测试库是有意为之（自动化 smoke 依赖 admin/admin123 登录），
 * 但生产环境绝不能带着已知默认口令对外提供服务。
 *
 * <p>因此这里做<b>启动守卫</b>：生产 profile 下，<b>对外 Web 进程</b>启动时扫描 {@code sys_user}，
 * 只要仍有账号在使用已知默认口令，就直接抛异常终止启动（fail-fast）。
 * Bootstrap CLI 是 {@code WebApplicationType.NONE}，本 Bean 不注册，以便
 * {@code grant-admin} 能在种子口令仍在时完成社区授权，并把档案口令封存为不可用哈希。
 *
 * <p>紧急放行：设置环境变量 {@code XINGYU_ALLOW_DEFAULT_ADMIN_PASSWORD=true} 可临时跳过
 * （仅用于已确认风险时的应急，默认关闭）。
 */
@Slf4j
@Component
@Profile("prod")
// 只在 Web 应用（对外提供服务的实例）启动时做守卫。Bootstrap CLI 是 WebApplicationType.NONE，
// 不对外提供服务；grant-admin 需要在种子口令仍在时启动上下文并封存档案哈希。
@ConditionalOnWebApplication
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class DefaultAdminPasswordGuard implements ApplicationRunner {

    /**
     * 需要拦截的已知默认口令。值本身不是"凭据"，而是"必须被判定为弱口令并拦截"的特征串，
     * 因此可以安全地写在代码里。可通过 xingyu.security.default-admin-passwords 追加。
     */
    /** 必须被判定为弱口令的特征串（不是可登录凭据）。 */
    public static final List<String> DEFAULT_PASSWORD_CANDIDATES = List.of("admin123", "123456", "admin");

    @Value("${xingyu.security.default-admin-passwords:admin123,123456,admin}")
    private String defaultPasswords;

    @Value("${XINGYU_ALLOW_DEFAULT_ADMIN_PASSWORD:${xingyu.security.allow-default-admin-password:false}}")
    private boolean allowDefaultAdminPassword;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (allowDefaultAdminPassword) {
            log.warn("⚠️ 已通过 XINGYU_ALLOW_DEFAULT_ADMIN_PASSWORD 跳过默认口令守卫，"
                    + "当前生产实例可能存在使用已知默认口令的账号。");
            return;
        }
        List<String> offenders = detectDefaultPasswordAccounts();
        if (!offenders.isEmpty()) {
            // 注意：此时应用已经停止对外提供服务，"进管理端改口令"是**不可达路径**，
            // 必须给出可直接在机器上执行的 Bootstrap CLI 命令。
            throw new IllegalStateException(
                    "生产环境启动中止：检测到仍在使用已知默认口令的档案账号 -> " + String.join(", ", offenders) + "。\n"
                            + "  对外 Web 进程拒绝启动。请先用 grant-admin 完成社区管理员授权；该命令会把\n"
                            + "  sys_user 中匹配的默认口令哈希封存为不可登录值，再启动 Web：\n"
                            + "    SPRING_PROFILES_ACTIVE=prod \\\n"
                            + "    XINGYU_DEPLOY_SECRET=<部署密钥> \\\n"
                            + "    XINGYU_BOOTSTRAP_COMMUNITY_ACCOUNT=<已有社区邮箱> \\\n"
                            + "    java -jar xingyu-starter-1.0.0.jar grant-admin --spring.profiles.active=prod\n"
                            + "  不要为启动 Web 而关闭本守卫或切换到 dev/test。");
        }
        log.info("默认口令守卫通过：未发现仍使用已知默认口令的管理员账号");
    }

    /**
     * 把仍匹配已知默认口令的 {@code sys_user} 哈希换成不可登录的随机 bcrypt。
     * 不改社区账号。明文随机口令不落库、不打日志。
     */
    public int replaceKnownDefaultHashesWithUnusable(Collection<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return 0;
        }
        List<Object[]> rows = jdbcTemplate.query(
                "SELECT id, password FROM sys_user WHERE password IS NOT NULL",
                (rs, rowNum) -> new Object[]{rs.getObject(1), rs.getString(2)});
        int sealed = 0;
        for (Object[] row : rows) {
            String hash = (String) row[1];
            if (hash == null || !hash.startsWith("$2")) {
                continue;
            }
            if (!matchesAny(hash, candidates)) {
                continue;
            }
            jdbcTemplate.update(
                    "UPDATE sys_user SET password = ? WHERE id = ?",
                    unusableBcryptHash(),
                    row[0]);
            sealed++;
        }
        if (sealed > 0) {
            log.info("sealed {} archive sys_user default password hash(es)", sealed);
        }
        return sealed;
    }

    /**
     * 扫描 sys_user，返回命中的账号列表（形如 {@code admin(默认口令命中)}，不含候选明文）。
     *
     * <p>只对 bcrypt（{@code $2*}）形态的口令做校验；NULL 或非 bcrypt 值跳过，
     * 避免历史脏数据导致启动失败 —— 这是数据形态判断，不是异常吞掉。
     */
    public List<String> detectDefaultPasswordAccounts() {
        List<String> candidates = Arrays.stream(
                        defaultPasswords == null ? new String[0] : defaultPasswords.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        return detectDefaultPasswordAccounts(candidates);
    }

    /** 使用显式候选口令列表扫描（便于测试与运维扩展）。 */
    public List<String> detectDefaultPasswordAccounts(Collection<String> candidates) {
        if (candidates.isEmpty()) {
            return List.of();
        }

        List<String[]> rows = jdbcTemplate.query(
                "SELECT username, password FROM sys_user WHERE password IS NOT NULL",
                (rs, rowNum) -> new String[]{rs.getString(1), rs.getString(2)});

        List<String> offenders = new ArrayList<>();
        for (String[] row : rows) {
            String username = row[0];
            String hash = row[1];
            if (hash == null || !hash.startsWith("$2")) {
                continue;
            }
            if (matchesAny(hash, candidates)) {
                offenders.add(username + "(默认口令命中)");
            }
        }
        return offenders;
    }

    private static boolean matchesAny(String hash, Collection<String> candidates) {
        for (String candidate : candidates) {
            if (BCrypt.checkpw(candidate, hash)) {
                return true;
            }
        }
        return false;
    }

    private static String unusableBcryptHash() {
        byte[] nonce = new byte[32];
        new SecureRandom().nextBytes(nonce);
        try {
            return BCrypt.hashpw(HexFormat.of().formatHex(nonce), BCrypt.gensalt());
        } finally {
            Arrays.fill(nonce, (byte) 0);
        }
    }
}
