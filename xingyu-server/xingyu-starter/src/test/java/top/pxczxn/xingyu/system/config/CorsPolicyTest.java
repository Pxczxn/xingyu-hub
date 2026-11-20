package top.pxczxn.xingyu.system.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CorsPolicyTest {

    @Test
    void productionAllowsOnlyExplicitOrigins() {
        CorsPolicy.Decision decision = CorsPolicy.decide(
                true, " https://xingyu.example , https://admin.xingyu.example ");

        assertFalse(decision.allowAnyOrigin());
        assertEquals(List.of("https://xingyu.example", "https://admin.xingyu.example"), decision.allowedOrigins());
        assertTrue(decision.allowCredentials());
    }

    @Test
    void productionWithoutOriginsOrWithWildcardFailsClosed() {
        for (String raw : new String[] {null, "", "   ", "*", "https://ok.example,*"}) {
            CorsPolicy.Decision decision = CorsPolicy.decide(true, raw);
            if ("https://ok.example,*".equals(raw)) {
                assertEquals(List.of("https://ok.example"), decision.allowedOrigins());
                assertTrue(decision.allowCredentials());
            } else {
                assertTrue(decision.allowedOrigins().isEmpty());
                assertFalse(decision.allowCredentials());
            }
            assertFalse(decision.allowAnyOrigin());
        }
    }

    @Test
    void nonProductionKeepsPermissiveDevelopmentBehavior() {
        CorsPolicy.Decision decision = CorsPolicy.decide(false, "");

        assertTrue(decision.allowAnyOrigin());
        assertTrue(decision.allowCredentials());
        assertTrue(decision.allowedOrigins().isEmpty());
    }
}
