package top.pxczxn.xingyu.core.bootstrap;

import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.entity.SysUserRole;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantPort;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantResult;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BootstrapService {

    private static final String PLATFORM_KIND = "PLATFORM";
    private static final String RECOVERY_KIND = "RECOVERY";
    private static final String ACTIVE = "ACTIVE";
    private static final long SUPER_ADMIN_ROLE_ID = 1L;
    private static final List<String> RECOVERY_DENIED = List.of(
            "CHAT_BODY", "GOVERNANCE_EVIDENCE", "USER_EXPORT");

    private final JdbcTemplate jdbcTemplate;
    private final SysUserMapper sysUserMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final Environment environment;
    private final CommunityAdminGrantPort communityAdminGrantPort;

    /**
     * 历史档案初始化：只写 {@code sys_user} / {@code sys_user_role} / {@code admin_account}。
     * 不授予社区管理端资格，也不改社区账号密码。管理端日常登录请用 {@link #grantCommunityAdmin()}。
     */
    @Transactional
    public void init() {
        String deploySecret = requireEnv("XINGYU_DEPLOY_SECRET");
        String password = requireEnv("XINGYU_BOOTSTRAP_PASSWORD");
        String username = envOrDefault("XINGYU_BOOTSTRAP_USERNAME", "admin");
        verifyDeploySecret(deploySecret);

        if (platformAdminExists()) {
            closeBootstrap();
            audit("bootstrap", "INIT", "already initialized", null, "SKIPPED");
            System.out.println("Bootstrap CLI : archive init skipped; community console admin requires grant-admin");
            return;
        }

        SysUser user = sysUserMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, username)
                .last("LIMIT 1"));
        String adminId = UUID.randomUUID().toString();
        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt());
        if (user == null) {
            user = new SysUser();
            user.setUsername(username);
            user.setPassword(passwordHash);
            user.setNickname("星语平台管理员");
            user.setStatus(1);
            user.setDeleted(0);
            sysUserMapper.insert(user);
            SysUserRole role = new SysUserRole();
            role.setUserId(user.getId());
            role.setRoleId(SUPER_ADMIN_ROLE_ID);
            sysUserRoleMapper.insert(role);
        } else {
            user.setPassword(passwordHash);
            sysUserMapper.updateById(user);
        }

        jdbcTemplate.update("""
                INSERT INTO admin_account (id, username, password_hash, kind, status, must_change_password, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """, adminId, username, passwordHash, PLATFORM_KIND, ACTIVE, Instant.now());

        closeBootstrap();
        audit("bootstrap", "INIT", "archive admin_account created", adminId, "SUCCESS");
        System.out.println("Bootstrap CLI : archive sys_user/admin_account initialized; "
                + "community console admin requires grant-admin");
    }

    /**
     * 将已有社区账号授予 {@code admin} 角色。账号由 {@code XINGYU_BOOTSTRAP_COMMUNITY_ACCOUNT} 邮箱定位。
     */
    @Transactional
    public void grantCommunityAdmin() {
        grantCommunityAdmin(
                requireEnv("XINGYU_DEPLOY_SECRET"),
                requireEnv("XINGYU_BOOTSTRAP_COMMUNITY_ACCOUNT"));
    }

    void grantCommunityAdmin(String deploySecret, String email) {
        requireExactProdProfile();
        verifyDeploySecret(deploySecret);
        CommunityAdminGrantResult result = communityAdminGrantPort.grantExistingByEmail(email);
        String outcome = result.alreadyGranted() ? "already granted" : "granted";
        audit("bootstrap", "GRANT_ADMIN", outcome, result.communityUserId(), "SUCCESS");
        System.out.println("Bootstrap CLI : community admin " + outcome
                + " id=" + result.communityUserId());
    }

    private void requireExactProdProfile() {
        String[] active = environment.getActiveProfiles();
        boolean prod = environment.acceptsProfiles(Profiles.of("prod"));
        boolean forbidden = environment.acceptsProfiles(Profiles.of("dev", "test", "browser-test"));
        if (!prod || forbidden || active.length != 1) {
            throw new IllegalStateException("grant-admin requires an explicit prod-only Spring profile");
        }
    }

    @Transactional
    public void recover() {
        String deploySecret = requireEnv("XINGYU_DEPLOY_SECRET");
        String password = requireEnv("XINGYU_BOOTSTRAP_PASSWORD");
        String reason = requireEnv("XINGYU_RECOVERY_REASON");
        verifyDeploySecret(deploySecret);

        String recoveryUsername = "recovery-" + UUID.randomUUID().toString().substring(0, 8);
        String adminId = UUID.randomUUID().toString();
        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt());
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(3600);

        SysUser user = new SysUser();
        user.setUsername(recoveryUsername);
        user.setPassword(passwordHash);
        user.setNickname("恢复管理员");
        user.setStatus(1);
        user.setDeleted(0);
        sysUserMapper.insert(user);

        SysUserRole role = new SysUserRole();
        role.setUserId(user.getId());
        role.setRoleId(SUPER_ADMIN_ROLE_ID);
        sysUserRoleMapper.insert(role);

        jdbcTemplate.update("""
                INSERT INTO admin_account (id, username, password_hash, kind, status, must_change_password, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """, adminId, recoveryUsername, passwordHash, RECOVERY_KIND, ACTIVE, now);

        String grantId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO recovery_grant (id, admin_id, reason, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, grantId, adminId, reason, expiresAt, now);

        for (String capability : RECOVERY_DENIED) {
            jdbcTemplate.update("""
                    INSERT INTO admin_capability (admin_id, capability, allowed)
                    VALUES (?, ?, 0)
                    """, adminId, capability);
        }

        audit("bootstrap", "RECOVER", reason, adminId, "SUCCESS");
    }

    @Transactional
    public void revokeRecovery() {
        verifyDeploySecret(requireEnv("XINGYU_DEPLOY_SECRET"));
        Instant now = Instant.now();
        List<Map<String, Object>> grants = jdbcTemplate.queryForList("""
                SELECT rg.id AS grant_id, rg.admin_id, aa.username
                FROM recovery_grant rg
                JOIN admin_account aa ON aa.id = rg.admin_id
                WHERE rg.revoked_at IS NULL AND rg.expires_at > ?
                """, now);
        for (Map<String, Object> grant : grants) {
            String grantId = grant.get("grant_id").toString();
            String adminId = grant.get("admin_id").toString();
            String username = grant.get("username").toString();
            jdbcTemplate.update("UPDATE recovery_grant SET revoked_at = ? WHERE id = ?", now, grantId);
            jdbcTemplate.update("UPDATE admin_account SET status = 'REVOKED' WHERE id = ?", adminId);
            SysUser user = sysUserMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                    .eq(SysUser::getUsername, username)
                    .last("LIMIT 1"));
            if (user != null) {
                user.setStatus(0);
                sysUserMapper.updateById(user);
            }
            audit("bootstrap", "REVOKE_RECOVERY", "recovery admin revoked", adminId, "SUCCESS");
        }
    }

    private boolean platformAdminExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM admin_account WHERE kind = ? AND status = ?",
                Integer.class, PLATFORM_KIND, ACTIVE);
        return count != null && count > 0;
    }

    private void closeBootstrap() {
        jdbcTemplate.update("""
                UPDATE bootstrap_state SET closed = 1, closed_at = ? WHERE id = 1
                """, Instant.now());
    }

    private void verifyDeploySecret(String deploySecret) {
        String hash = sha256(deploySecret);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT param_value FROM system_parameter
                WHERE namespace = 'SYSTEM' AND param_key = 'bootstrap.deploy_secret_hash'
                """);
        if (rows.isEmpty()) {
            jdbcTemplate.update("""
                    INSERT INTO system_parameter (namespace, param_key, param_value)
                    VALUES ('SYSTEM', 'bootstrap.deploy_secret_hash', ?)
                    ON DUPLICATE KEY UPDATE param_value = VALUES(param_value)
                    """, hash);
            return;
        }
        if (!hash.equals(rows.get(0).get("param_value"))) {
            throw new IllegalStateException("invalid deploy secret");
        }
    }

    private void audit(String actor, String action, String reason, String targetId, String result) {
        jdbcTemplate.update("""
                INSERT INTO admin_audit (actor, action, reason, target_id, result, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, actor, action, reason, targetId, result, Instant.now());
    }

    private static String requireEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value.trim();
    }

    private static String envOrDefault(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
