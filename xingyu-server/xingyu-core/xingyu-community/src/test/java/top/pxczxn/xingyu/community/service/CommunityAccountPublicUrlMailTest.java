package top.pxczxn.xingyu.community.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.AuthSecurityEventMapper;
import top.pxczxn.xingyu.community.mapper.CommunityCreationSpaceMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunitySessionMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.EmailVerificationTokenMapper;
import top.pxczxn.xingyu.community.mapper.RegistrationIdempotencyMapper;
import top.pxczxn.xingyu.community.mapper.ReservedWordMapper;
import top.pxczxn.xingyu.community.mapper.UsernameHistoryMapper;
import top.pxczxn.xingyu.mail.EmailService;
import top.pxczxn.xingyu.sms.SmsServiceFactory;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CaptchaService;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommunityAccountPublicUrlMailTest {

    @Test
    void passwordResetAndVerificationLinksUsePublicOrigin() {
        SysConfigGroupService groups = mock(SysConfigGroupService.class);
        SysConfigGroup system = new SysConfigGroup();
        system.setConfigValue("{}");
        SysConfigGroup register = new SysConfigGroup();
        register.setConfigValue("{\"verifyEmail\":true}");
        when(groups.getByGroupCode("system")).thenReturn(system);
        when(groups.getByGroupCode("register")).thenReturn(register);
        SystemConfigHelper configHelper = new SystemConfigHelper(groups, new ObjectMapper());
        ReflectionTestUtils.setField(configHelper, "configuredPublicBaseUrl", "https://pxczxn.top/");

        CommunityUserMapper userMapper = mock(CommunityUserMapper.class);
        EmailVerificationTokenMapper tokenMapper = mock(EmailVerificationTokenMapper.class);
        EmailService emailService = mock(EmailService.class);
        AuthSecurityEventMapper securityEventMapper = mock(AuthSecurityEventMapper.class);

        CommunityUser user = new CommunityUser();
        user.setId("user-1");
        user.setEmail("reader@example.com");
        user.setStatus("ACTIVE");
        when(userMapper.findByEmail("reader@example.com")).thenReturn(user);
        when(tokenMapper.consumePending(anyString(), anyString(), any())).thenReturn(1);
        when(tokenMapper.insert(any())).thenReturn(1);

        CommunityAccountService service = new CommunityAccountService(
                userMapper,
                mock(CommunityProfileMapper.class),
                mock(CommunityCreationSpaceMapper.class),
                tokenMapper,
                mock(RegistrationIdempotencyMapper.class),
                mock(CommunitySessionMapper.class),
                mock(ReservedWordMapper.class),
                mock(UsernameHistoryMapper.class),
                emailService,
                securityEventMapper,
                mock(RecentAuthenticationService.class),
                configHelper,
                mock(CaptchaService.class),
                mock(SmsServiceFactory.class),
                mock(StringRedisTemplate.class),
                new ObjectMapper());

        service.requestPasswordRecovery("reader@example.com");
        ArgumentCaptor<String> resetLink = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetLink(eq("reader@example.com"), resetLink.capture());
        assertThat(resetLink.getValue())
                .startsWith("https://pxczxn.top/reset-password?token=")
                .doesNotContain("localhost")
                .doesNotContain("127.0.0.1");

        service.resendVerification("reader@example.com");
        ArgumentCaptor<String> verifyLink = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendEmailVerificationLink(
                eq("reader@example.com"), verifyLink.capture(), anyString());
        assertThat(verifyLink.getValue())
                .startsWith("https://pxczxn.top/verify-email?token=")
                .contains("&email=reader@example.com")
                .doesNotContain("localhost");
    }
}
