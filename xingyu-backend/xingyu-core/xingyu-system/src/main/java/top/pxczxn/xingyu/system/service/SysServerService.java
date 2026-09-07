package top.pxczxn.xingyu.system.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.system.entity.SysServer;

/**
 * 服务器管理 Service
 */
public interface SysServerService extends IService<SysServer> {
    
    /**
     * 分页查询服务器列表
     */
    Page<SysServer> pageList(Page<SysServer> page, String name, Integer status);
    
    /**
     * 测试服务器连接
     */
    boolean testConnection(Long id);
    
    /**
     * 测试服务器连接（通过参数）
     */
    boolean testConnection(String host, Integer port, String username, Integer authType, 
                          String password, String privateKey, String passphrase);
}
