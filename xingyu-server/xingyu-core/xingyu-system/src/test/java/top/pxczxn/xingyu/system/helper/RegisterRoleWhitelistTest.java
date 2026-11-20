package top.pxczxn.xingyu.system.helper;

import top.pxczxn.xingyu.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegisterRoleWhitelistTest {

    @Test
    void defaultAndCommonCommunityRolesStayAllowed() {
        assertEquals("user", RegisterRoleWhitelist.normalizeOrFallback("user"));
        assertEquals("member", RegisterRoleWhitelist.normalizeOrFallback("member"));
        assertEquals("creator", RegisterRoleWhitelist.normalizeOrFallback("creator"));
    }

    @Test
    void mixedCaseAndWhitespaceNormalizeToWhitelist() {
        assertEquals("user", RegisterRoleWhitelist.normalizeOrFallback(" USER "));
        assertEquals("creator", RegisterRoleWhitelist.normalizeOrFallback("Creator"));
        assertEquals("member", RegisterRoleWhitelist.normalizeOrFallback("MEMBER"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void blankFallsBackToUser(String raw) {
        assertEquals("user", RegisterRoleWhitelist.normalizeOrFallback(raw));
    }

    @ParameterizedTest
    @ValueSource(strings = {"admin", "ADMIN", "operator", "super_admin", "root", "staff"})
    void privilegedAndUnknownRolesFallBackToUser(String raw) {
        assertEquals("user", RegisterRoleWhitelist.normalizeOrFallback(raw));
    }

    @Test
    void saveRejectsPrivilegedRoles() {
        assertThrows(BusinessException.class, () -> RegisterRoleWhitelist.requireAllowedForSave("admin"));
        assertThrows(BusinessException.class, () -> RegisterRoleWhitelist.requireAllowedForSave("operator"));
        assertThrows(BusinessException.class, () -> RegisterRoleWhitelist.requireAllowedForSave("super_admin"));
        assertThrows(BusinessException.class, () -> RegisterRoleWhitelist.requireAllowedForSave("unknown"));
    }

    @Test
    void ordinaryCommunityRolesAreWhitelistOnly() {
        assertTrue(RegisterRoleWhitelist.isOrdinaryCommunityRole("user"));
        assertTrue(RegisterRoleWhitelist.isOrdinaryCommunityRole(" MEMBER "));
        assertTrue(RegisterRoleWhitelist.isOrdinaryCommunityRole("Creator"));
        assertFalse(RegisterRoleWhitelist.isOrdinaryCommunityRole("admin"));
        assertFalse(RegisterRoleWhitelist.isOrdinaryCommunityRole("FOUNDER"));
        assertFalse(RegisterRoleWhitelist.isOrdinaryCommunityRole(null));
        assertFalse(RegisterRoleWhitelist.isOrdinaryCommunityRole("  "));
    }

    @Test
    void saveAllowsBlankAndWhitelistedRoles() {
        RegisterRoleWhitelist.requireAllowedForSave(null);
        RegisterRoleWhitelist.requireAllowedForSave("");
        RegisterRoleWhitelist.requireAllowedForSave("user");
        RegisterRoleWhitelist.requireAllowedForSave(" MEMBER ");
        RegisterRoleWhitelist.requireAllowedForSave("creator");
    }
}
