package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.SysLoginLog;
import top.pxczxn.xingyu.system.mapper.SysLoginLogMapper;
import top.pxczxn.xingyu.system.service.SysLoginLogService;
import top.pxczxn.xingyu.system.util.IpUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

/**
 * 登录日志服务实现
 */
@Service
@RequiredArgsConstructor
public class SysLoginLogServiceImpl extends ServiceImpl<SysLoginLogMapper, SysLoginLog> implements SysLoginLogService {

    @Override
    public PageResult<SysLoginLog> page(Integer page, Integer pageSize, String username, Integer status) {
        Page<SysLoginLog> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<SysLoginLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(username), SysLoginLog::getUsername, username)
                .eq(status != null, SysLoginLog::getStatus, status)
                .orderByDesc(SysLoginLog::getLoginTime);
        return PageResult.of(this.page(pageParam, wrapper));
    }

    @Override
    @Async
    public void recordLog(String username, Integer status, String msg, String ip, String browser, String os) {
        SysLoginLog loginLog = new SysLoginLog();
        loginLog.setUsername(username);
        loginLog.setStatus(status);
        loginLog.setMsg(msg);
        loginLog.setIpaddr(ip);
        // 解析IP地址获取登录地点
        loginLog.setLoginLocation(IpUtils.getAddressByIp(ip));
        loginLog.setBrowser(browser);
        loginLog.setOs(os);
        loginLog.setLoginTime(LocalDateTime.now());
        this.save(loginLog);
    }

    @Override
    public void clean() {
        this.remove(new LambdaQueryWrapper<>());
    }
}
