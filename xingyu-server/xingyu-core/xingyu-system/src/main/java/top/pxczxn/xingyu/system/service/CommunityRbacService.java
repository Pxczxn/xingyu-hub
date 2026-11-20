package top.pxczxn.xingyu.system.service;

import top.pxczxn.xingyu.system.rbac.CommunityGrantedRole;

import java.util.List;

/**
 * 社区用户 RBAC 只读能力。尚未接入 Sa-Token 或任何请求拦截器。
 *
 * <p>不计算 {@code sys_role.data_scope}：该字段依赖 {@code sys_user.dept_id}，本批不得查询
 * {@code sys_user}。持有角色不等于拥有全部数据访问权。
 */
public interface CommunityRbacService {

    List<CommunityGrantedRole> listRoles(String communityUserId);

    List<String> listRoleCodes(String communityUserId);

    List<String> listPermissions(String communityUserId);

    boolean hasRole(String communityUserId, String roleCode);

    boolean hasPermission(String communityUserId, String permission);

    List<String> listCommunityUserIdsByRoleCode(String roleCode);
}
