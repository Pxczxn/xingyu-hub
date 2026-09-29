package top.pxczxn.xingyu.system.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.system.entity.SysUserRole;

/**
 * 用户角色关联服务接口
 */
public interface SysUserRoleService extends IService<SysUserRole> {

    /**
     * 删除用户的所有角色
     */
    void deleteByUserId(Long userId);

    /**
     * 删除角色的所有用户关联
     */
    void deleteByRoleId(Long roleId);
}
