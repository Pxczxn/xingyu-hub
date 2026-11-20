package top.pxczxn.xingyu.community.identity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminConsoleRoleCodesTest {

    @Test
    void onlyAdminIsAllowed() {
        assertTrue(AdminConsoleRoleCodes.isAllowed("admin"));
        assertTrue(AdminConsoleRoleCodes.isAllowed(" ADMIN "));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "user", "member", "creator", "operator", "super_admin", "cid3_staff", "FOUNDER"})
    void otherCodesAreDenied(String code) {
        assertFalse(AdminConsoleRoleCodes.isAllowed(code));
    }
}
