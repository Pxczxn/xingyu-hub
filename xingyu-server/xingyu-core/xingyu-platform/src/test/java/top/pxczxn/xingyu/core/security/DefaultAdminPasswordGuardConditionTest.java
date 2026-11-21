package top.pxczxn.xingyu.core.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Profile;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DefaultAdminPasswordGuardConditionTest {

    @Test
    void guardIsProdWebOnly() {
        Profile profile = DefaultAdminPasswordGuard.class.getAnnotation(Profile.class);
        assertNotNull(profile);
        assertArrayEquals(new String[]{"prod"}, profile.value());
        ConditionalOnWebApplication web =
                DefaultAdminPasswordGuard.class.getAnnotation(ConditionalOnWebApplication.class);
        assertNotNull(web);
        assertEquals(ConditionalOnWebApplication.Type.ANY, web.type());
    }
}
