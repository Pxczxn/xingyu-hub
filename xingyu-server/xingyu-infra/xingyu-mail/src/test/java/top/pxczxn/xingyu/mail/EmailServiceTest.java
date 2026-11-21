package top.pxczxn.xingyu.mail;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailServiceTest {

    @Test
    void sendTestMailBodyOmitsSmtpHostAndCredentials() {
        MailConfigProvider config = mock(MailConfigProvider.class);
        when(config.getSiteName()).thenReturn("星语");
        when(config.isEmailEnabled()).thenReturn(true);
        EmailService service = spy(new EmailService(config));
        doNothing().when(service).sendSimpleMail(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());

        service.sendTestMail("reader@example.com");

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(service).sendSimpleMail(org.mockito.ArgumentMatchers.eq("reader@example.com"),
                org.mockito.ArgumentMatchers.contains("测试邮件"),
                body.capture());
        assertThat(body.getValue())
                .contains("测试邮件")
                .doesNotContain("smtp")
                .doesNotContain("发件服务器")
                .doesNotContain("smtp.qq.com")
                .doesNotContain("password");
    }

    @Test
    void sendSimpleMailWhenDisabledThrowsWithoutSmtpDetails() {
        MailConfigProvider config = mock(MailConfigProvider.class);
        when(config.isEmailEnabled()).thenReturn(false);
        when(config.getEmailPassword()).thenReturn("smtp-pass-secret");
        EmailService service = new EmailService(config);

        assertThatThrownBy(() -> service.sendSimpleMail("reader@example.com", "s", "c"))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("邮件服务未启用")
                .hasMessageNotContaining("smtp-pass-secret");
    }
}
