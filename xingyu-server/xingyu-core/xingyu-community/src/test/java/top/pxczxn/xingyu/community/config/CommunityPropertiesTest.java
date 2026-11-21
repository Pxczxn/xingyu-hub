package top.pxczxn.xingyu.community.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import top.pxczxn.xingyu.common.config.PublicBaseUrls;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CommunityPropertiesTest {

    @Test
    void defaultWithoutProfileIsDevelopmentOrigin() {
        CommunityProperties properties = new CommunityProperties();
        assertEquals(PublicBaseUrls.DEVELOPMENT_DEFAULT, properties.normalizedPublicBaseUrl());
    }

    @Test
    void productionBlankOrLocalhostBecomesOfficialOrigin() {
        CommunityProperties properties = new CommunityProperties();
        properties.setPublicBaseUrl("http://localhost:3000");
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(org.mockito.ArgumentMatchers.any(Profiles.class))).thenReturn(true);
        properties.setEnvironment(environment);

        assertEquals("https://pxczxn.top", properties.normalizedPublicBaseUrl());
    }

    @Test
    void envBoundValueIsNormalized() {
        CommunityProperties properties = new CommunityProperties();
        properties.setPublicBaseUrl("https://pxczxn.top/");
        assertEquals("https://pxczxn.top", properties.normalizedPublicBaseUrl());
    }
}
