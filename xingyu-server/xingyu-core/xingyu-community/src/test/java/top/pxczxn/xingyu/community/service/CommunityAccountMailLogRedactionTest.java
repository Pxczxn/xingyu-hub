package top.pxczxn.xingyu.community.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
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
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CaptchaService;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CommunityAccountMailLogRedactionTest {

    private static final String RAW_TOKEN_MARKER = "deadbeefcafebabe";
    private static final String TEMP_PASSWORD = "TempP@ssw0rd99";
    private static final String RECIPIENT = "reader@example.com";

    private ListAppender<ILoggingEvent> appender;
    private Logger logger;
    private CommunityAccountService service;
    private EmailService emailService;
    private CommunityUserMapper userMapper;

    @BeforeEach
    void setUp() {
        logger = (Logger) LoggerFactory.getLogger(CommunityAccountService.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        SysConfigGroupService groups = mock(SysConfigGroupService.class);
        SysConfigGroup system = new SysConfigGroup();
        system.setConfigValue("{}");
        SysConfigGroup register = new SysConfigGroup();
        register.setConfigValue("{\"verifyEmail\":true}");
        SysConfigGroup password = new SysConfigGroup();
        password.setConfigValue("{\"minLength\":8,\"maxLength\":64}");
        when(groups.getByGroupCode("system")).thenReturn(system);
        when(groups.getByGroupCode("register")).thenReturn(register);
        when(groups.getByGroupCode("password")).thenReturn(password);
        SystemConfigHelper configHelper = new SystemConfigHelper(groups, new ObjectMapper());
        ReflectionTestUtils.setField(configHelper, "configuredPublicBaseUrl", "https://pxczxn.top/");

        userMapper = mock(CommunityUserMapper.class);
        EmailVerificationTokenMapper tokenMapper = mock(EmailVerificationTokenMapper.class);
        emailService = mock(EmailService.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(tokenMapper.consumePending(anyString(), anyString(), any())).thenReturn(1);
        when(tokenMapper.insert(any())).thenReturn(1);

        CommunityUser user = new CommunityUser();
        user.setId("user-1");
        user.setEmail(RECIPIENT);
        user.setStatus("ACTIVE");
        when(userMapper.findByEmail(RECIPIENT)).thenReturn(user);
        when(userMapper.selectById("user-1")).thenReturn(user);

        service = new CommunityAccountService(
                userMapper,
                mock(CommunityProfileMapper.class),
                mock(CommunityCreationSpaceMapper.class),
                tokenMapper,
                mock(RegistrationIdempotencyMapper.class),
                mock(CommunitySessionMapper.class),
                mock(ReservedWordMapper.class),
                mock(UsernameHistoryMapper.class),
                emailService,
                mock(AuthSecurityEventMapper.class),
                mock(RecentAuthenticationService.class),
                configHelper,
                mock(CaptchaService.class),
                mock(SmsServiceFactory.class),
                redis,
                new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
    }

    @Test
    void verificationFailureLogsDoNotContainRawTokenOrFullEmail() {
        doThrow(new RuntimeException("smtp password=qq-secret token=" + RAW_TOKEN_MARKER))
                .when(emailService).sendEmailVerificationLink(anyString(), anyString(), anyString());

        service.resendVerification(RECIPIENT);

        String logs = renderedLogs();
        assertThat(logs).contains("verification mail not sent");
        assertThat(logs).doesNotContain(RAW_TOKEN_MARKER);
        assertThat(logs).doesNotContain("token=" + RAW_TOKEN_MARKER);
        assertThat(logs).doesNotContain(RECIPIENT);
        assertThat(logs).doesNotContain("qq-secret");
        assertThat(logs).contains("r***@example.com");
        assertThat(logs).doesNotContain("https://pxczxn.top/verify-email");
    }

    @Test
    void passwordResetFailureLogsDoNotContainRawTokenOrLink() {
        doThrow(new RuntimeException("reset failed token=" + RAW_TOKEN_MARKER))
                .when(emailService).sendPasswordResetLink(anyString(), anyString());

        service.requestPasswordRecovery(RECIPIENT);

        String logs = renderedLogs();
        assertThat(logs).contains("password reset mail not sent");
        assertThat(logs).doesNotContain(RAW_TOKEN_MARKER);
        assertThat(logs).doesNotContain("/reset-password?token=");
        assertThat(logs).doesNotContain(RECIPIENT);
        assertThat(logs).contains("r***@example.com");
    }

    @Test
    void adminTempPasswordFailureLogsDoNotContainPlaintextPassword() {
        doThrow(new RuntimeException("smtp failed password=" + TEMP_PASSWORD))
                .when(emailService).sendResetPassword(anyString(), anyString(), Mockito.anyInt());

        service.adminResetPassword("user-1");

        String logs = renderedLogs();
        assertThat(logs).contains("admin temp password mail not sent");
        assertThat(logs).doesNotContain(TEMP_PASSWORD);
        assertThat(logs).doesNotContain("dev admin temp password");
        assertThat(logs).doesNotContain(RECIPIENT);
        assertThat(logs).contains("r***@example.com");
    }

    private String renderedLogs() {
        return appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .collect(Collectors.joining("\n"));
    }
}
