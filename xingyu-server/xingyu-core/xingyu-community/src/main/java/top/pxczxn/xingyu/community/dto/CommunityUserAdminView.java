package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CommunityUserAdminView {
    String id;
    String email;
    String username;
    String displayName;
    String phone;
    String status;
    String role;
    boolean emailVerified;
    boolean phoneVerified;
    String createdAt;
}
