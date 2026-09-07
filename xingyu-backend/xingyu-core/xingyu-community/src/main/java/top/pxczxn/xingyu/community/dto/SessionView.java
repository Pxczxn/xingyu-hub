package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SessionView {
    String sessionId;
    String deviceLabel;
    String lastActiveAt;
    String expiresAt;
    boolean revoked;
    boolean current;
}
