package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoginResult {
    String token;
    boolean mustChangePassword;
}
