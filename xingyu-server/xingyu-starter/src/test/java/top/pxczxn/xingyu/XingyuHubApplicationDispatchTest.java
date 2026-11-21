package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.bootstrap.BootstrapMain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class XingyuHubApplicationDispatchTest {

    @Test
    void webLaunchIsNotTreatedAsBootstrapCli() {
        assertFalse(BootstrapMain.isBootstrapInvocation(new String[]{}));
        assertFalse(BootstrapMain.isBootstrapInvocation(new String[]{"--spring.profiles.active=prod"}));
    }

    @Test
    void grantAdminIsBootstrapCliAndDoesNotUseWebEntry() {
        assertTrue(BootstrapMain.isBootstrapInvocation(
                new String[]{"grant-admin", "--spring.profiles.active=prod"}));
    }
}
