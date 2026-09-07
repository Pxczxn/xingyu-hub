package top.pxczxn.xingyu.system.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.SysLoginLog;

/**
 * 登录日志服务接口
 */
public interface SysLoginLogService extends IService<SysLoginLog> {

    /**
     * 分页查询登录日志
     */
    PageResult<SysLoginLog> page(Integer page, Integer pageSize, String username, Integer status);

    /**
     * 记录登录日志
     */
    void recordLog(String username, Integer status, String msg, String ip, String browser, String os);

    /**
     * 清空登录日志
     */
    void clean();
}
