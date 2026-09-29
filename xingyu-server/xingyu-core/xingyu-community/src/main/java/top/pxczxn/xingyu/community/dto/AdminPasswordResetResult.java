package top.pxczxn.xingyu.community.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminPasswordResetResult {
    /** 邮件是否未成功投递（true 表示 SMTP 发送失败，需管理员手动告知临时密码） */
    private boolean mailPending;
    private String mailError;
    private String recipientEmail;
    /** 本次重置的临时密码（仅管理端返回，便于邮件未达时人工告知用户） */
    private String tempPassword;
}
