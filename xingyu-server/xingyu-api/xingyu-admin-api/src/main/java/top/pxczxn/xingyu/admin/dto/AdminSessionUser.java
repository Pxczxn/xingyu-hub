package top.pxczxn.xingyu.admin.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AdminSessionUser {
    String id;
    String username;
    String nickname;
    String avatar;
    String email;
    String phone;
    Integer gender;
    Integer status;
    String userType;
    String createTime;
    Long lockVersion;
    String deptName;
    String postNames;
    String remark;
}
