package top.pxczxn.xingyu.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MailLogSupportTest {

    @Test
    void maskEmailKeepsDomainAndHidesLocalPart() {
        assertThat(MailLogSupport.maskEmail("reader@example.com")).isEqualTo("r***@example.com");
        assertThat(MailLogSupport.maskEmail("  ")).isEqualTo("(none)");
    }

    @Test
    void sanitizeDetailStripsTokensPasswordsAndAddresses() {
        String raw = "failed for reader@example.com ?token=abcdef123 and password=secret user=smtpuser smtp.qq.com host, port: smtp.qq.com, 465";
        String sanitized = MailLogSupport.sanitizeDetail(raw);
        assertThat(sanitized)
                .doesNotContain("reader@example.com")
                .doesNotContain("abcdef123")
                .doesNotContain("secret")
                .doesNotContain("smtpuser")
                .doesNotContain("smtp.qq.com")
                .contains("token=***")
                .contains("password=***");
    }

    @Test
    void sanitizeExceptionKeepsTypeWithoutCredentials() {
        RuntimeException ex = new RuntimeException("AUTH failed password=qq-auth-code user=123456");
        String sanitized = MailLogSupport.sanitizeException(ex);
        assertThat(sanitized).startsWith("RuntimeException:");
        assertThat(sanitized).doesNotContain("qq-auth-code");
        assertThat(sanitized).doesNotContain("123456");
    }

    @Test
    void testMailBodyOmitsSmtpHostAndUsername() {
        String body = MailLogSupport.testMailBody("星语");
        assertThat(body).contains("测试邮件");
        assertThat(body).doesNotContain("smtp");
        assertThat(body).doesNotContain("发件服务器");
        assertThat(body).doesNotContain("发件人：");
    }
}
