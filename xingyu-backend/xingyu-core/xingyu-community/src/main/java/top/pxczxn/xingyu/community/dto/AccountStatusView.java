package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class AccountStatusView {
    String status;
    boolean canChangeEmail;
    boolean canChangePassword;
    boolean requiresReAuth;
    List<String> allowedActions;
}
