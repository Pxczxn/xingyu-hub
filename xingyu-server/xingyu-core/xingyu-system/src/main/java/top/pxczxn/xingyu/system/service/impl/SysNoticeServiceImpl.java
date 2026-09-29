package top.pxczxn.xingyu.system.service.impl;

import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.mail.EmailService;
import top.pxczxn.xingyu.system.dto.SysNoticeVo;
import top.pxczxn.xingyu.system.entity.SysNotice;
import top.pxczxn.xingyu.system.entity.SysNoticeSendLog;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.entity.SysUserNotice;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.mapper.SysNoticeMapper;
import top.pxczxn.xingyu.system.mapper.SysNoticeSendLogMapper;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserNoticeMapper;
import top.pxczxn.xingyu.system.service.SysNoticeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class SysNoticeServiceImpl implements SysNoticeService {

    private final SysNoticeMapper noticeMapper;
    private final SysNoticeSendLogMapper sendLogMapper;
    private final SysUserNoticeMapper userNoticeMapper;
    private final SysUserMapper userMapper;
    private final EmailService emailService;
    private final SystemConfigHelper configHelper;

    @Override
    public PageResult<SysNoticeVo> page(Integer page, Integer pageSize, String title, Integer noticeType, Integer status) {
        Page<SysNotice> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<SysNotice> wrapper = new LambdaQueryWrapper<SysNotice>()
                .like(StringUtils.hasText(title), SysNotice::getTitle, title)
                .eq(noticeType != null, SysNotice::getNoticeType, noticeType)
                .eq(status != null, SysNotice::getStatus, status)
                .orderByDesc(SysNotice::getCreateTime);
        Page<SysNotice> result = noticeMapper.selectPage(pageParam, wrapper);
        List<SysNoticeVo> list = result.getRecords().stream().map(this::toVo).toList();
        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public PageResult<SysNoticeVo> myNotices(Long userId, Integer page, Integer pageSize, Integer isRead) {
        LambdaQueryWrapper<SysUserNotice> userNoticeWrapper = new LambdaQueryWrapper<SysUserNotice>()
                .eq(SysUserNotice::getUserId, userId)
                .eq(isRead != null, SysUserNotice::getIsRead, isRead)
                .orderByDesc(SysUserNotice::getId);
        Page<SysUserNotice> userNoticePage = userNoticeMapper.selectPage(new Page<>(page, pageSize), userNoticeWrapper);
        List<SysNoticeVo> list = userNoticePage.getRecords().stream()
                .map(un -> {
                    SysNotice notice = noticeMapper.selectById(un.getNoticeId());
                    if (notice == null || notice.getStatus() == null || notice.getStatus() != 1) {
                        return null;
                    }
                    SysNoticeVo vo = toVo(notice);
                    vo.setIsRead(un.getIsRead());
                    return vo;
                })
                .filter(Objects::nonNull)
                .toList();
        return PageResult.of(list, userNoticePage.getTotal(), userNoticePage.getCurrent(), userNoticePage.getSize());
    }

    @Override
    public SysNoticeVo detail(Long id) {
        SysNotice notice = requireNotice(id);
        return toVo(notice);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void create(SysNoticeVo notice, Long operatorId, String operatorName) {
        SysNotice entity = fromVo(notice);
        entity.setStatus(0);
        entity.setCreateBy(operatorId);
        entity.setCreateName(operatorName);
        entity.setCreateTime(LocalDateTime.now());
        entity.setUpdateTime(LocalDateTime.now());
        entity.setDeleted(0);
        noticeMapper.insert(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void update(SysNoticeVo notice) {
        if (notice.getId() == null) {
            throw new BusinessException("通知ID不能为空");
        }
        SysNotice existing = requireNotice(notice.getId());
        SysNotice entity = fromVo(notice);
        entity.setId(existing.getId());
        entity.setUpdateTime(LocalDateTime.now());
        noticeMapper.updateById(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        noticeMapper.deleteById(id);
        userNoticeMapper.delete(new LambdaQueryWrapper<SysUserNotice>().eq(SysUserNotice::getNoticeId, id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void publish(Long id, Long operatorId) {
        SysNotice notice = requireNotice(id);
        notice.setStatus(1);
        notice.setUpdateTime(LocalDateTime.now());
        noticeMapper.updateById(notice);

        List<String> channels = parseChannels(notice.getChannels());
        List<Long> targetUserIds = resolveTargetUserIds(notice);
        if (channels.contains("station")) {
            deliverStation(notice.getId(), targetUserIds);
        }
        for (String channel : channels) {
            if ("station".equals(channel)) {
                continue;
            }
            dispatchChannel(notice, channel, targetUserIds);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markRead(Long userId, Long noticeId) {
        SysUserNotice userNotice = userNoticeMapper.selectOne(new LambdaQueryWrapper<SysUserNotice>()
                .eq(SysUserNotice::getUserId, userId)
                .eq(SysUserNotice::getNoticeId, noticeId));
        if (userNotice == null) {
            userNotice = new SysUserNotice();
            userNotice.setUserId(userId);
            userNotice.setNoticeId(noticeId);
            userNotice.setIsRead(1);
            userNotice.setReadTime(LocalDateTime.now());
            userNoticeMapper.insert(userNotice);
            return;
        }
        userNotice.setIsRead(1);
        userNotice.setReadTime(LocalDateTime.now());
        userNoticeMapper.updateById(userNotice);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markAllRead(Long userId) {
        List<SysUserNotice> unread = userNoticeMapper.selectList(new LambdaQueryWrapper<SysUserNotice>()
                .eq(SysUserNotice::getUserId, userId)
                .eq(SysUserNotice::getIsRead, 0));
        LocalDateTime now = LocalDateTime.now();
        for (SysUserNotice item : unread) {
            item.setIsRead(1);
            item.setReadTime(now);
            userNoticeMapper.updateById(item);
        }
    }

    @Override
    public int unreadCount(Long userId) {
        Long count = userNoticeMapper.selectCount(new LambdaQueryWrapper<SysUserNotice>()
                .eq(SysUserNotice::getUserId, userId)
                .eq(SysUserNotice::getIsRead, 0));
        return count == null ? 0 : count.intValue();
    }

    @Override
    public List<Map<String, Object>> availableChannels() {
        List<Map<String, Object>> channels = new ArrayList<>();
        channels.add(channelOption("station", "站内信", true));
        channels.add(channelOption("email", "邮件", configHelper.isEmailEnabled()));
        channels.add(channelOption("dingtalk", "钉钉", isWebhookConfigured("dingtalk")));
        channels.add(channelOption("feishu", "飞书", isWebhookConfigured("feishu")));
        channels.add(channelOption("wechat_work", "企业微信", isWebhookConfigured("wechat_work")));
        return channels;
    }

    @Override
    public List<SysNoticeSendLog> sendLogs(Long noticeId) {
        return sendLogMapper.selectList(new LambdaQueryWrapper<SysNoticeSendLog>()
                .eq(SysNoticeSendLog::getNoticeId, noticeId)
                .orderByDesc(SysNoticeSendLog::getSendTime));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void retryChannel(Long noticeId, String channel) {
        SysNotice notice = requireNotice(noticeId);
        if (notice.getStatus() == null || notice.getStatus() != 1) {
            throw new BusinessException("仅已发布的通知可重试推送");
        }
        List<Long> targetUserIds = resolveTargetUserIds(notice);
        if ("station".equals(channel)) {
            deliverStation(noticeId, targetUserIds);
            recordSendLog(noticeId, channel, 1, targetUserIds.size(), targetUserIds.size(), null);
            return;
        }
        dispatchChannel(notice, channel, targetUserIds);
    }

    private void deliverStation(Long noticeId, List<Long> targetUserIds) {
        for (Long userId : targetUserIds) {
            SysUserNotice existing = userNoticeMapper.selectOne(new LambdaQueryWrapper<SysUserNotice>()
                    .eq(SysUserNotice::getUserId, userId)
                    .eq(SysUserNotice::getNoticeId, noticeId));
            if (existing != null) {
                continue;
            }
            SysUserNotice userNotice = new SysUserNotice();
            userNotice.setUserId(userId);
            userNotice.setNoticeId(noticeId);
            userNotice.setIsRead(0);
            userNoticeMapper.insert(userNotice);
        }
    }

    private void dispatchChannel(SysNotice notice, String channel, List<Long> targetUserIds) {
        int targetCount = targetUserIds.size();
        int successCount = 0;
        String errorMsg = null;
        try {
            switch (channel) {
                case "email" -> successCount = sendEmail(notice, targetUserIds);
                case "dingtalk", "feishu", "wechat_work" -> {
                    boolean ok = sendWebhook(channel, notice.getTitle(), notice.getContent());
                    successCount = ok ? targetCount : 0;
                    if (!ok) {
                        errorMsg = "Webhook 推送失败";
                    }
                }
                case "webhook" -> {
                    String provider = configHelper.getPushProvider();
                    boolean ok = sendWebhook(provider, notice.getTitle(), notice.getContent());
                    successCount = ok ? targetCount : 0;
                    if (!ok) {
                        errorMsg = "Webhook 推送失败";
                    }
                }
                default -> throw new BusinessException("不支持的推送渠道: " + channel);
            }
        } catch (Exception ex) {
            log.error("通知推送失败 noticeId={} channel={}", notice.getId(), channel, ex);
            errorMsg = StrUtil.maxLength(ex.getMessage(), 480);
            successCount = 0;
        }
        int status = errorMsg == null && successCount > 0 ? 1 : 2;
        recordSendLog(notice.getId(), channel, status, targetCount, successCount, errorMsg);
    }

    private int sendEmail(SysNotice notice, List<Long> targetUserIds) {
        int success = 0;
        for (Long userId : targetUserIds) {
            SysUser user = userMapper.selectById(userId);
            if (user == null || !StringUtils.hasText(user.getEmail())) {
                continue;
            }
            try {
                emailService.sendSimpleMail(user.getEmail(), notice.getTitle(), notice.getContent());
                success++;
            } catch (Exception ex) {
                log.warn("通知邮件发送失败 userId={} email={}", userId, user.getEmail(), ex);
            }
        }
        return success;
    }

    private void recordSendLog(Long noticeId, String channel, int status, int targetCount, int successCount, String errorMsg) {
        SysNoticeSendLog logEntry = new SysNoticeSendLog();
        logEntry.setNoticeId(noticeId);
        logEntry.setChannel(channel);
        logEntry.setStatus(status);
        logEntry.setTargetCount(targetCount);
        logEntry.setSuccessCount(successCount);
        logEntry.setErrorMsg(errorMsg);
        logEntry.setSendTime(LocalDateTime.now());
        sendLogMapper.insert(logEntry);
    }

    private List<Long> resolveTargetUserIds(SysNotice notice) {
        Integer targetType = notice.getTargetType() == null ? 3 : notice.getTargetType();
        if (targetType == 1) {
            return parseTargetIds(notice.getTargetIds());
        }
        if (targetType == 2) {
            List<Long> deptIds = parseTargetIds(notice.getTargetIds());
            if (deptIds.isEmpty()) {
                return List.of();
            }
            return userMapper.selectList(new LambdaQueryWrapper<SysUser>()
                            .eq(SysUser::getStatus, 1)
                            .in(SysUser::getDeptId, deptIds))
                    .stream()
                    .map(SysUser::getId)
                    .toList();
        }
        return userMapper.selectList(new LambdaQueryWrapper<SysUser>().eq(SysUser::getStatus, 1))
                .stream()
                .map(SysUser::getId)
                .toList();
    }

    private SysNotice requireNotice(Long id) {
        SysNotice notice = noticeMapper.selectById(id);
        if (notice == null) {
            throw new BusinessException("通知不存在");
        }
        return notice;
    }

    private SysNoticeVo toVo(SysNotice notice) {
        SysNoticeVo vo = new SysNoticeVo();
        vo.setId(notice.getId());
        vo.setTitle(notice.getTitle());
        vo.setContent(notice.getContent());
        vo.setNoticeType(notice.getNoticeType());
        vo.setChannels(parseChannels(notice.getChannels()));
        vo.setTargetType(notice.getTargetType());
        vo.setTargetIds(parseTargetIds(notice.getTargetIds()));
        vo.setStatus(notice.getStatus());
        vo.setCreateBy(notice.getCreateBy());
        vo.setCreateName(notice.getCreateName());
        vo.setCreateTime(notice.getCreateTime());
        vo.setUpdateTime(notice.getUpdateTime());
        return vo;
    }

    private SysNotice fromVo(SysNoticeVo vo) {
        SysNotice notice = new SysNotice();
        notice.setTitle(vo.getTitle());
        notice.setContent(vo.getContent());
        notice.setNoticeType(vo.getNoticeType());
        notice.setChannels(JSONUtil.toJsonStr(vo.getChannels() == null ? List.of("station") : vo.getChannels()));
        notice.setTargetType(vo.getTargetType() == null ? 3 : vo.getTargetType());
        notice.setTargetIds(vo.getTargetIds() == null || vo.getTargetIds().isEmpty()
                ? null
                : JSONUtil.toJsonStr(vo.getTargetIds()));
        notice.setStatus(vo.getStatus());
        return notice;
    }

    private List<String> parseChannels(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of("station");
        }
        if (raw.trim().startsWith("[")) {
            return JSONUtil.parseArray(raw).toList(String.class);
        }
        return List.of(raw.split(","));
    }

    private List<Long> parseTargetIds(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        if (raw.trim().startsWith("[")) {
            return JSONUtil.parseArray(raw).stream()
                    .map(item -> Long.valueOf(String.valueOf(item)))
                    .toList();
        }
        return List.of(raw.split(",")).stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(Long::valueOf)
                .toList();
    }

    private boolean sendWebhook(String provider, String title, String content) {
        String webhookUrl = configHelper.getPushTokenId(provider);
        if (!StringUtils.hasText(webhookUrl)) {
            return false;
        }
        String text = title + "\n" + content;
        String body;
        if ("dingtalk".equals(provider)) {
            body = JSONUtil.toJsonStr(Map.of(
                    "msgtype", "text",
                    "text", Map.of("content", text)));
        } else if ("feishu".equals(provider)) {
            body = JSONUtil.toJsonStr(Map.of(
                    "msg_type", "text",
                    "content", Map.of("text", text)));
        } else {
            body = JSONUtil.toJsonStr(Map.of(
                    "msgtype", "text",
                    "text", Map.of("content", text)));
        }
        try {
            String response = HttpUtil.post(webhookUrl, body);
            return response == null || !response.contains("\"errcode\"");
        } catch (Exception ex) {
            log.warn("Webhook 推送失败 provider={}", provider, ex);
            return false;
        }
    }

    private boolean isWebhookConfigured(String provider) {
        return StringUtils.hasText(configHelper.getPushTokenId(provider));
    }

    private Map<String, Object> channelOption(String code, String name, boolean enabled) {
        Map<String, Object> option = new HashMap<>();
        option.put("code", code);
        option.put("name", name);
        option.put("enabled", enabled);
        return option;
    }
}
