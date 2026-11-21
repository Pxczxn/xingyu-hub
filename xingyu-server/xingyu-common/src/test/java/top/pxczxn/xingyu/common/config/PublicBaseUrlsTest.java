package top.pxczxn.xingyu.common.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicBaseUrlsTest {

    @Test
    void productionDefaultIsOfficialCommunityOrigin() {
        assertEquals("https://pxczxn.top", PublicBaseUrls.PRODUCTION_DEFAULT);
        assertEquals(
                "https://pxczxn.top",
                PublicBaseUrls.resolve(null, null, true));
    }

    @Test
    void environmentOverrideWinsInProduction() {
        assertEquals(
                "https://staging.pxczxn.top",
                PublicBaseUrls.resolve(null, "https://staging.pxczxn.top/", true));
    }

    @Test
    void stripsTrailingSlashes() {
        assertEquals("https://pxczxn.top", PublicBaseUrls.normalize("https://pxczxn.top/"));
        assertEquals("https://pxczxn.top", PublicBaseUrls.normalize(" https://pxczxn.top/// "));
    }

    @Test
    void productionDoesNotSilentlyKeepLocalhostConfiguredDefault() {
        assertEquals(
                "https://pxczxn.top",
                PublicBaseUrls.resolve(null, "http://localhost:3000", true));
        assertEquals(
                "https://pxczxn.top",
                PublicBaseUrls.resolve("", "http://127.0.0.1:7777", true));
    }

    @Test
    void explicitPreferredOverridesIncludingLocalhost() {
        assertEquals(
                "http://127.0.0.1:7777",
                PublicBaseUrls.resolve("http://127.0.0.1:7777/", null, true));
    }

    @Test
    void nonProductionKeepsDevelopmentDefault() {
        assertEquals(
                "http://localhost:3000",
                PublicBaseUrls.resolve(null, null, false));
        assertEquals(
                "http://localhost:3000",
                PublicBaseUrls.resolve(null, "http://localhost:3000", false));
    }

    @Test
    void loopbackDetection() {
        assertTrue(PublicBaseUrls.isLoopbackOrigin("http://localhost:3000"));
        assertTrue(PublicBaseUrls.isLoopbackOrigin("http://127.0.0.1:7777"));
        assertFalse(PublicBaseUrls.isLoopbackOrigin("https://pxczxn.top"));
    }
}
