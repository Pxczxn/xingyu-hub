package top.pxczxn.xingyu.system.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.test.util.ReflectionTestUtils;
import top.pxczxn.xingyu.common.config.PublicBaseUrls;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemConfigHelperTest {

    @Test
    void usesDefaultCommunityMailTemplateWhenPersistedTemplateIsBlank() {
        SysConfigGroupService service = mock(SysConfigGroupService.class);
        SysConfigGroup group = new SysConfigGroup();
        group.setConfigValue("{\"verifyEmail\":\"\",\"passwordResetLink\":\"\"}");
        when(service.getByGroupCode("emailTemplate")).thenReturn(group);

        SystemConfigHelper helper = new SystemConfigHelper(service, new ObjectMapper());

        assertEquals("请点击链接完成邮箱验证：{link}", helper.getEmailTemplateVerifyEmailLink());
        assertEquals("请点击链接设置新密码：{link}", helper.getEmailTemplatePasswordResetLink());
    }

    @Test
    void registerDefaultRoleFallsBackWhenConfigGrantsAdmin() {
        SysConfigGroupService service = mock(SysConfigGroupService.class);
        SysConfigGroup group = new SysConfigGroup();
        group.setConfigValue("{\"enabled\":true,\"defaultRole\":\"admin\"}");
        when(service.getByGroupCode("register")).thenReturn(group);

        SystemConfigHelper helper = new SystemConfigHelper(service, new ObjectMapper());

        assertEquals("user", helper.getRegisterDefaultRole());
    }

    @Test
    void registerDefaultRoleAllowsCreator() {
        SysConfigGroupService service = mock(SysConfigGroupService.class);
        SysConfigGroup group = new SysConfigGroup();
        group.setConfigValue("{\"enabled\":true,\"defaultRole\":\"Creator\"}");
        when(service.getByGroupCode("register")).thenReturn(group);

        SystemConfigHelper helper = new SystemConfigHelper(service, new ObjectMapper());

        assertEquals("creator", helper.getRegisterDefaultRole());
    }

    @Test
    void communityWebUrlUsesProductionPublicOriginWhenDatabaseBlank() {
        SystemConfigHelper helper = helperWithSystemJson("{}");
        ReflectionTestUtils.setField(helper, "configuredPublicBaseUrl", "https://pxczxn.top/");
        ReflectionTestUtils.setField(helper, "environment", productionEnvironment());

        assertEquals("https://pxczxn.top", helper.getCommunityWebUrl());
    }

    @Test
    void communityWebUrlFallsBackToProductionDefaultWhenDatabaseAndYamlBlank() {
        SystemConfigHelper helper = helperWithSystemJson("{\"communityWebUrl\":\"\"}");
        ReflectionTestUtils.setField(helper, "configuredPublicBaseUrl", "");
        ReflectionTestUtils.setField(helper, "environment", productionEnvironment());

        assertEquals(PublicBaseUrls.PRODUCTION_DEFAULT, helper.getCommunityWebUrl());
    }

    @Test
    void explicitDatabaseCommunityWebUrlOverridesPublicBaseUrl() {
        SystemConfigHelper helper = helperWithSystemJson(
                "{\"communityWebUrl\":\"https://custom.example.com/\"}");
        ReflectionTestUtils.setField(helper, "configuredPublicBaseUrl", "https://pxczxn.top");
        ReflectionTestUtils.setField(helper, "environment", productionEnvironment());

        assertEquals("https://custom.example.com", helper.getCommunityWebUrl());
    }

    @Test
    void nonProductionBlankDatabaseUsesDevelopmentPublicOrigin() {
        SystemConfigHelper helper = helperWithSystemJson("{}");

        assertEquals(PublicBaseUrls.DEVELOPMENT_DEFAULT, helper.getCommunityWebUrl());
    }

    private static SystemConfigHelper helperWithSystemJson(String json) {
        SysConfigGroupService service = mock(SysConfigGroupService.class);
        SysConfigGroup group = new SysConfigGroup();
        group.setConfigValue(json);
        when(service.getByGroupCode("system")).thenReturn(group);
        return new SystemConfigHelper(service, new ObjectMapper());
    }

    private static Environment productionEnvironment() {
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(org.mockito.ArgumentMatchers.any(Profiles.class))).thenReturn(true);
        return environment;
    }
}
