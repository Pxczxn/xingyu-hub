package top.pxczxn.xingyu.system.service;

import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.dto.SysNoticeVo;
import top.pxczxn.xingyu.system.entity.SysNoticeSendLog;

import java.util.List;
import java.util.Map;

public interface SysNoticeService {

    PageResult<SysNoticeVo> page(Integer page, Integer pageSize, String title, Integer noticeType, Integer status);

    PageResult<SysNoticeVo> myNotices(Long userId, Integer page, Integer pageSize, Integer isRead);

    SysNoticeVo detail(Long id);

    void create(SysNoticeVo notice, Long operatorId, String operatorName);

    void update(SysNoticeVo notice);

    void delete(Long id);

    void publish(Long id, Long operatorId);

    void markRead(Long userId, Long noticeId);

    void markAllRead(Long userId);

    int unreadCount(Long userId);

    List<Map<String, Object>> availableChannels();

    List<SysNoticeSendLog> sendLogs(Long noticeId);

    void retryChannel(Long noticeId, String channel);
}
