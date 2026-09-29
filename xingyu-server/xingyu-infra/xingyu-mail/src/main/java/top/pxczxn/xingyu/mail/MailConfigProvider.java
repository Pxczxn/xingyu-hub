package top.pxczxn.xingyu.mail;

/**
 * 邮件配置提供者
 */
public interface MailConfigProvider {

    boolean isEmailEnabled();

    String getEmailHost();

    int getEmailPort();

    String getEmailUsername();

    String getEmailPassword();

    String getEmailFromName();

    boolean isEmailSsl();

    String getEmailTemplateVerifyCode();

    String getEmailTemplateResetPassword();

    String getEmailTemplateVerifyEmailLink();

    String getEmailTemplatePasswordResetLink();

    String getEmailTemplateWelcome();

    String getSiteName();
}

