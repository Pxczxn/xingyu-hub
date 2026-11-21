package top.pxczxn.xingyu.mail;

import java.util.regex.Pattern;

/**
 * Redacts addresses, tokens, and SMTP details from mail logs and test-mail bodies.
 */
public final class MailLogSupport {

    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern PASSWORD_ASSIGN = Pattern.compile("(?i)(password|pwd)\\s*[=:]\\s*[^\\s,;]+");
    private static final Pattern USER_ASSIGN = Pattern.compile("(?i)(user(name)?|uid)\\s*[=:]\\s*[^\\s,;]+");
    private static final Pattern TOKEN_ASSIGN = Pattern.compile("(?i)(token)\\s*[=:]\\s*[^\\s,;&]+");
    private static final Pattern SMTP_HOST = Pattern.compile("(?i)smtp\\.[\\w.-]+");
    private static final Pattern HOST_PORT = Pattern.compile("(?i)host[,\\s]+port:\\s*[^;]+");

    private MailLogSupport() {}

    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "(none)";
        }
        String trimmed = email.trim();
        int at = trimmed.indexOf('@');
        if (at <= 0 || at == trimmed.length() - 1) {
            return "***";
        }
        String local = trimmed.substring(0, at);
        String domain = trimmed.substring(at + 1);
        String prefix = local.substring(0, 1);
        return prefix + "***@" + domain;
    }

    public static String sanitizeDetail(String detail) {
        if (detail == null || detail.isBlank()) {
            return "";
        }
        String redacted = TOKEN_ASSIGN.matcher(detail).replaceAll("$1=***");
        redacted = PASSWORD_ASSIGN.matcher(redacted).replaceAll("$1=***");
        redacted = USER_ASSIGN.matcher(redacted).replaceAll("$1=***");
        redacted = HOST_PORT.matcher(redacted).replaceAll("host, port:***");
        redacted = SMTP_HOST.matcher(redacted).replaceAll("smtp.***");
        redacted = EMAIL.matcher(redacted).replaceAll("***@***");
        redacted = redacted.replaceAll("\\s+", " ").trim();
        if (redacted.length() > 180) {
            return redacted.substring(0, 180) + "…";
        }
        return redacted;
    }

    public static String sanitizeException(Throwable ex) {
        if (ex == null) {
            return "unknown";
        }
        String type = ex.getClass().getSimpleName();
        String detail = sanitizeDetail(ex.getMessage());
        return detail.isEmpty() ? type : type + ": " + detail;
    }

    public static String testMailBody(String siteName) {
        String name = siteName == null || siteName.isBlank() ? "星语" : siteName;
        return "这是一封测试邮件，如果您收到此邮件，说明邮件服务配置正确。\n\n"
                + "发送时间：" + java.time.LocalDateTime.now() + "\n"
                + "站点：" + name + "\n";
    }
}
