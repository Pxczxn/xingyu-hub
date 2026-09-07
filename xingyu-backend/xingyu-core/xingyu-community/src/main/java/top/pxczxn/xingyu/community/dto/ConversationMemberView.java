package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ConversationMemberView {
    String userId;
    String username;
    String displayName;
    String role;
}
