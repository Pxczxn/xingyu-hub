package top.pxczxn.xingyu.system.rbac;

import lombok.Data;

/**
 * 社区用户经 {@code community_user_role} 获得的有效角色。不含数据范围。
 */
@Data
public class CommunityGrantedRole {

    private Long id;
    private String code;
    private String name;
}
