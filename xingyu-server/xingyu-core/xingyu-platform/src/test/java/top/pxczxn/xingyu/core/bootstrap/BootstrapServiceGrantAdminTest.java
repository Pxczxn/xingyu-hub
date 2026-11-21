package top.pxczxn.xingyu.core.bootstrap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantPort;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantResult;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserRoleMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.springframework.jdbc.core.RowMapper;

import cn.hutool.crypto.digest.BCrypt;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BootstrapServiceGrantAdminTest {

    private static final String SECRET = "deploy-secret";
    private static final String EMAIL = "ops@example.com";
    private static final String USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";

    private JdbcTemplate jdbcTemplate;
    private Environment environment;
    private CommunityAdminGrantPort grantPort;
    private BootstrapService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        environment = mock(Environment.class);
        grantPort = mock(CommunityAdminGrantPort.class);
        service = new BootstrapService(
                jdbcTemplate,
                mock(SysUserMapper.class),
                mock(SysUserRoleMapper.class),
                environment,
                grantPort);
    }

    @Test
    void nonProdProfileIsRejectedBeforeGrant() {
        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(false);
        when(environment.acceptsProfiles(Profiles.of("dev", "test", "browser-test"))).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.grantCommunityAdmin(SECRET, EMAIL));
        verify(grantPort, never()).grantExistingByEmail(anyString());
        verify(jdbcTemplate, never()).update(anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void mixedProdAndDevIsRejected() {
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod", "dev"});
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(environment.acceptsProfiles(Profiles.of("dev", "test", "browser-test"))).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.grantCommunityAdmin(SECRET, EMAIL));
        verify(grantPort, never()).grantExistingByEmail(anyString());
    }

    @Test
    void wrongDeploySecretIsRejected() {
        stubProdOnly();
        when(jdbcTemplate.queryForList(contains("bootstrap.deploy_secret_hash")))
                .thenReturn(List.of(Map.of("param_value", "not-the-hash")));
        IllegalStateException ex = assertThrows(
                IllegalStateException.class, () -> service.grantCommunityAdmin(SECRET, EMAIL));
        assertEquals("invalid deploy secret", ex.getMessage());
        verify(grantPort, never()).grantExistingByEmail(anyString());
    }

    @Test
    void matchingSecretGrantsThenSealsArchiveDefaultHashes() {
        stubProdOnly();
        String expectedHash = sha256Hex(SECRET);
        when(jdbcTemplate.queryForList(contains("bootstrap.deploy_secret_hash")))
                .thenReturn(List.of(Map.of("param_value", expectedHash)));
        when(grantPort.grantExistingByEmail(EMAIL))
                .thenReturn(new CommunityAdminGrantResult(USER_ID, false));
        String seedHash = BCrypt.hashpw("admin123", BCrypt.gensalt());
        when(jdbcTemplate.query(contains("FROM sys_user"), any(RowMapper.class)))
                .thenReturn(java.util.Collections.singletonList(new Object[]{1L, seedHash}));
        when(jdbcTemplate.update(contains("UPDATE sys_user SET password"), any(), any())).thenReturn(1);

        service.grantCommunityAdmin(SECRET, EMAIL);

        verify(grantPort).grantExistingByEmail(EMAIL);
        verify(jdbcTemplate).update(contains("UPDATE sys_user SET password"), any(), eq(1L));
        verify(jdbcTemplate).update(
                contains("INSERT INTO admin_audit"),
                eq("bootstrap"),
                eq("GRANT_ADMIN"),
                eq("granted"),
                eq(USER_ID),
                eq("SUCCESS"),
                any());
    }

    @Test
    void missingCommunityAccountStillSealsArchiveHashesAfterSecretCheck() {
        stubProdOnly();
        String expectedHash = sha256Hex(SECRET);
        when(jdbcTemplate.queryForList(contains("bootstrap.deploy_secret_hash")))
                .thenReturn(List.of(Map.of("param_value", expectedHash)));
        String seedHash = BCrypt.hashpw("admin123", BCrypt.gensalt());
        when(jdbcTemplate.query(contains("FROM sys_user"), any(RowMapper.class)))
                .thenReturn(java.util.Collections.singletonList(new Object[]{1L, seedHash}));
        when(jdbcTemplate.update(contains("UPDATE sys_user SET password"), any(), any())).thenReturn(1);
        when(grantPort.grantExistingByEmail(EMAIL)).thenThrow(new IllegalStateException("community account not found"));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class, () -> service.grantCommunityAdmin(SECRET, EMAIL));
        assertEquals("community account not found", ex.getMessage());
        verify(jdbcTemplate).update(contains("UPDATE sys_user SET password"), any(), eq(1L));
        verify(jdbcTemplate, never()).update(contains("INSERT INTO admin_audit"), any(), any(), any(), any(), any(), any());
    }

    private void stubProdOnly() {
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.acceptsProfiles(Profiles.of("prod"))).thenReturn(true);
        when(environment.acceptsProfiles(Profiles.of("dev", "test", "browser-test"))).thenReturn(false);
    }

    private static String sha256Hex(String value) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
