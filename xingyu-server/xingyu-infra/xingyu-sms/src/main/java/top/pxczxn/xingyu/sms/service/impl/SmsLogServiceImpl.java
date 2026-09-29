package top.pxczxn.xingyu.sms.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import top.pxczxn.xingyu.sms.entity.SmsLog;
import top.pxczxn.xingyu.sms.mapper.SmsLogMapper;
import top.pxczxn.xingyu.sms.service.SmsLogService;
import top.pxczxn.xingyu.system.util.IpUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

/**
 * 短信发送记录 Service 实现
 */
@Service
public class SmsLogServiceImpl extends ServiceImpl<SmsLogMapper, SmsLog> implements SmsLogService {

    @Override
    public void log(String phone, String content, String smsType, String templateId,
                    String templateParams, String provider, boolean success,
                    String resultMsg, String bizId, Long userId, String bizType, String ip) {
        SmsLog smsLog = new SmsLog();
        smsLog.setPhone(phone);
        smsLog.setContent(content);
        smsLog.setSmsType(smsType);
        smsLog.setTemplateId(templateId);
        smsLog.setTemplateParams(templateParams);
        smsLog.setProvider(provider);
        smsLog.setStatus(success ? 1 : 2);
        smsLog.setResultMsg(resultMsg);
        smsLog.setBizId(bizId);
        smsLog.setSendTime(LocalDateTime.now());
        smsLog.setUserId(userId);
        smsLog.setBizType(bizType);
        smsLog.setIp(ip);
        save(smsLog);
    }

    @Override
    public void logVerifyCode(String phone, String code, String provider, boolean success, String resultMsg, String bizId) {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attrs != null ? attrs.getRequest() : null;
        String ip = IpUtils.getIpAddr(request);
        log(phone, code, "verify_code", null, null, provider, success, resultMsg, bizId, null, "login", ip);
    }
}
