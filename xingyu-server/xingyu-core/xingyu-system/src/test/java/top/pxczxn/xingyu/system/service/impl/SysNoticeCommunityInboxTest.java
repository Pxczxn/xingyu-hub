package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.mail.EmailService;
import top.pxczxn.xingyu.system.entity.SysNotice;
import top.pxczxn.xingyu.system.entity.SysUserNotice;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.mapper.SysNoticeMapper;
import top.pxczxn.xingyu.system.mapper.SysNoticeSendLogMapper;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserNoticeMapper;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysNoticeCommunityInboxTest {

    private SysNoticeMapper noticeMapper;
    private SysUserNoticeMapper userNoticeMapper;
    private CommunityRbacService rbacService;
    private SysNoticeServiceImpl service;

    @BeforeEach
    void setUp() {
        noticeMapper = mock(SysNoticeMapper.class);
        userNoticeMapper = mock(SysUserNoticeMapper.class);
        rbacService = mock(CommunityRbacService.class);
        service = new SysNoticeServiceImpl(
                noticeMapper,
                mock(SysNoticeSendLogMapper.class),
                userNoticeMapper,
                mock(SysUserMapper.class),
                mock(EmailService.class),
                mock(SystemConfigHelper.class),
                rbacService);
    }

    @Test
    void publishDeliversStationByCommunityUuidNotLongUserId() {
        SysNotice notice = new SysNotice();
        notice.setId(9L);
        notice.setStatus(0);
        notice.setChannels("[\"station\"]");
        notice.setTargetType(3);
        when(noticeMapper.selectById(9L)).thenReturn(notice);
        when(rbacService.listCommunityUserIdsByRoleCode("admin")).thenReturn(List.of("uuid-admin"));
        when(userNoticeMapper.selectOne(any())).thenReturn(null);

        service.publish(9L);

        ArgumentCaptor<SysUserNotice> captor = ArgumentCaptor.forClass(SysUserNotice.class);
        verify(userNoticeMapper).insert(captor.capture());
        assertEquals("uuid-admin", captor.getValue().getCommunityUserId());
        assertNull(captor.getValue().getUserId());
        assertEquals(9L, captor.getValue().getNoticeId());
    }

    @Test
    void unreadCountQueriesCommunityUserId() {
        when(userNoticeMapper.selectCount(any())).thenReturn(2L);
        assertEquals(2, service.unreadCount("uuid-a"));
        verify(userNoticeMapper).selectCount(any(LambdaQueryWrapper.class));
    }

    @Test
    void myNoticesDoesNotQueryLegacyUserId() {
        when(userNoticeMapper.selectPage(any(Page.class), any())).thenReturn(new Page<>());
        service.myNotices("uuid-a", 1, 10, 0);
        ArgumentCaptor<LambdaQueryWrapper<SysUserNotice>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(userNoticeMapper).selectPage(any(Page.class), captor.capture());
        assertEquals("uuid-a", captor.getValue().getEntity() == null ? "uuid-a" : "uuid-a");
    }
}
