package top.pxczxn.xingyu.system.service;

import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.dto.SysNoticeConsoleRecipient;
import top.pxczxn.xingyu.system.dto.SysNoticePublishResult;
import top.pxczxn.xingyu.system.dto.SysNoticeVo;
import top.pxczxn.xingyu.system.entity.SysNoticeSendLog;

import java.util.List;
import java.util.Map;

public interface SysNoticeService {

    PageResult<SysNoticeVo> page(Integer page, Integer pageSize, String title, Integer noticeType, Integer status);

    PageResult<SysNoticeVo> myNotices(String communityUserId, Integer page, Integer pageSize, Integer isRead);

    SysNoticeVo detail(Long id);

    void create(SysNoticeVo notice, String operatorName);

    void update(SysNoticeVo notice);

    void delete(Long id);

    SysNoticePublishResult publish(Long id);

    List<SysNoticeConsoleRecipient> listConsoleRecipients();

    void markRead(String communityUserId, Long noticeId);

    void markAllRead(String communityUserId);

    int unreadCount(String communityUserId);

    List<Map<String, Object>> availableChannels();

    List<SysNoticeSendLog> sendLogs(Long noticeId);

    void retryChannel(Long noticeId, String channel);
}
