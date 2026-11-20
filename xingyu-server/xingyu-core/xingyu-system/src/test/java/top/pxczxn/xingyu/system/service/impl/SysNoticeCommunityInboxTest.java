package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.mail.EmailService;
import top.pxczxn.xingyu.system.dto.SysNoticePublishResult;
import top.pxczxn.xingyu.system.entity.SysNotice;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.entity.SysUserNotice;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.identity.AdminConsoleIdentityPort;
import top.pxczxn.xingyu.system.identity.AdminConsolePrincipal;
import top.pxczxn.xingyu.system.mapper.SysNoticeMapper;
import top.pxczxn.xingyu.system.mapper.SysNoticeSendLogMapper;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserNoticeMapper;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysNoticeCommunityInboxTest {

    private static final String ADMIN_A = "11111111-1111-1111-1111-111111111111";
    private static final String ADMIN_B = "22222222-2222-2222-2222-222222222222";
    private static final String MEMBER = "33333333-3333-3333-3333-333333333333";
    private static final String MISSING = "44444444-4444-4444-4444-444444444444";
    private static final String SUSPENDED_ADMIN = "55555555-5555-5555-5555-555555555555";
    private static final String REJECTED_ADMIN = "77777777-7777-7777-7777-777777777777";
    private static final String UNVERIFIED_ADMIN = "66666666-6666-6666-6666-666666666666";

    private SysNoticeMapper noticeMapper;
    private SysUserNoticeMapper userNoticeMapper;
    private SysUserMapper userMapper;
    private EmailService emailService;
    private CommunityRbacService rbacService;
    private AdminConsoleIdentityPort identityPort;
    private SysNoticeServiceImpl service;

    @BeforeEach
    void setUp() {
        noticeMapper = mock(SysNoticeMapper.class);
        userNoticeMapper = mock(SysUserNoticeMapper.class);
        userMapper = mock(SysUserMapper.class);
        emailService = mock(EmailService.class);
        rbacService = mock(CommunityRbacService.class);
        identityPort = mock(AdminConsoleIdentityPort.class);
        service = new SysNoticeServiceImpl(
                noticeMapper,
                mock(SysNoticeSendLogMapper.class),
                userNoticeMapper,
                userMapper,
                emailService,
                mock(SystemConfigHelper.class),
                rbacService,
                identityPort);
        when(userNoticeMapper.selectOne(any())).thenReturn(null);
    }

    @Test
    void publishDeliversStationByCommunityUuidNotLongUserId() {
        stubNotice(9L, "[\"station\"]", 3, null);
        when(rbacService.listCommunityUserIdsByRoleCode("admin")).thenReturn(List.of("uuid-admin"));
        when(identityPort.canAccessAdminConsole("uuid-admin")).thenReturn(true);

        SysNoticePublishResult result = service.publish(9L);

        ArgumentCaptor<SysUserNotice> captor = ArgumentCaptor.forClass(SysUserNotice.class);
        verify(userNoticeMapper).insert(captor.capture());
        assertEquals("uuid-admin", captor.getValue().getCommunityUserId());
        assertNull(captor.getValue().getUserId());
        assertEquals(9L, captor.getValue().getNoticeId());
        assertEquals(1, result.stationDelivered());
    }

    @Test
    void allStationDeliversOnlyEligibleAdminAccounts() {
        stubNotice(3L, "[\"station\"]", 3, null);
        when(rbacService.listCommunityUserIdsByRoleCode("admin")).thenReturn(List.of(
                ADMIN_A, SUSPENDED_ADMIN, REJECTED_ADMIN, UNVERIFIED_ADMIN, MEMBER));
        when(identityPort.canAccessAdminConsole(ADMIN_A)).thenReturn(true);
        when(identityPort.canAccessAdminConsole(SUSPENDED_ADMIN)).thenReturn(false);
        when(identityPort.canAccessAdminConsole(REJECTED_ADMIN)).thenReturn(false);
        when(identityPort.canAccessAdminConsole(UNVERIFIED_ADMIN)).thenReturn(false);
        when(identityPort.canAccessAdminConsole(MEMBER)).thenReturn(false);

        SysNoticePublishResult result = service.publish(3L);

        ArgumentCaptor<SysUserNotice> captor = ArgumentCaptor.forClass(SysUserNotice.class);
        verify(userNoticeMapper).insert(captor.capture());
        assertEquals(ADMIN_A, captor.getValue().getCommunityUserId());
        assertEquals(1, result.stationDelivered());
        verify(identityPort).canAccessAdminConsole(ADMIN_A);
        verify(identityPort).canAccessAdminConsole(SUSPENDED_ADMIN);
        verify(identityPort).canAccessAdminConsole(REJECTED_ADMIN);
        verify(identityPort).canAccessAdminConsole(UNVERIFIED_ADMIN);
        verify(identityPort).canAccessAdminConsole(MEMBER);
    }

    @Test
    void allStationWithNoEligibleRecipientIsRejected() {
        stubNotice(3L, "[\"station\"]", 3, null);
        when(rbacService.listCommunityUserIdsByRoleCode("admin")).thenReturn(List.of(SUSPENDED_ADMIN, MEMBER));
        when(identityPort.canAccessAdminConsole(SUSPENDED_ADMIN)).thenReturn(false);
        when(identityPort.canAccessAdminConsole(MEMBER)).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(3L));
        assertTrue(ex.getMessage().contains("没有有效后台收件人"));
        verify(userNoticeMapper, never()).insert(any());
        verify(noticeMapper, never()).updateById(any());
    }

    @Test
    void specifiedAdminUuidCreatesInboxRow() {
        stubNotice(1L, "[\"station\"]", 1, "[\"" + ADMIN_A + "\"]");
        stubConsoleUser(ADMIN_A, true);

        SysNoticePublishResult result = service.publish(1L);

        ArgumentCaptor<SysUserNotice> captor = ArgumentCaptor.forClass(SysUserNotice.class);
        verify(userNoticeMapper).insert(captor.capture());
        assertEquals(ADMIN_A, captor.getValue().getCommunityUserId());
        assertNull(captor.getValue().getUserId());
        assertEquals(1, result.stationDelivered());
    }

    @Test
    void specifiedMultipleAdminUuidsCreateInboxRows() {
        stubNotice(1L, "[\"station\"]", 1, "[\"" + ADMIN_A + "\",\"" + ADMIN_B + "\"]");
        stubConsoleUser(ADMIN_A, true);
        stubConsoleUser(ADMIN_B, true);

        SysNoticePublishResult result = service.publish(1L);

        verify(userNoticeMapper, times(2)).insert(any());
        assertEquals(2, result.stationDelivered());
    }

    @Test
    void ordinaryCommunityUuidIsRejected() {
        stubNotice(1L, "[\"station\"]", 1, "[\"" + MEMBER + "\"]");
        stubConsoleUser(MEMBER, false);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("后台资格"));
        verify(userNoticeMapper, never()).insert(any());
    }

    @Test
    void missingUuidIsRejected() {
        stubNotice(1L, "[\"station\"]", 1, "[\"" + MISSING + "\"]");
        when(identityPort.lookupById(MISSING)).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("不存在"));
        verify(userNoticeMapper, never()).insert(any());
    }

    @Test
    void numericArchiveIdIsNotTreatedAsCommunityUuid() {
        stubNotice(1L, "[\"station\"]", 1, "[1,2]");

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("社区 UUID"));
        verify(userNoticeMapper, never()).insert(any());
        verify(identityPort, never()).lookupById(any());
    }

    @Test
    void emptySpecifiedTargetsAreRejected() {
        stubNotice(1L, "[\"station\"]", 1, "[]");

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("不能为空"));
        verify(userNoticeMapper, never()).insert(any());
    }

    @Test
    void duplicateSpecifiedTargetsAreRejected() {
        stubNotice(1L, "[\"station\"]", 1, "[\"" + ADMIN_A + "\",\"" + ADMIN_A + "\"]");

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("重复"));
        verify(userNoticeMapper, never()).insert(any());
        verify(identityPort, never()).canAccessAdminConsole(any());
    }

    @Test
    void departmentStationChannelIsRejected() {
        stubNotice(1L, "[\"station\"]", 2, "[3]");

        BusinessException ex = assertThrows(BusinessException.class, () -> service.publish(1L));
        assertTrue(ex.getMessage().contains("按部门"));
        verify(userNoticeMapper, never()).insert(any());
    }

    @Test
    void departmentEmailStillResolvesSysUserArchive() {
        stubNotice(1L, "[\"email\"]", 2, "[5]");
        SysUser archive = new SysUser();
        archive.setId(8L);
        archive.setEmail("ops@example.com");
        when(userMapper.selectList(any())).thenReturn(List.of(archive));
        when(userMapper.selectById(8L)).thenReturn(archive);

        SysNoticePublishResult result = service.publish(1L);

        verify(emailService).sendSimpleMail(eq("ops@example.com"), any(), any());
        verify(userNoticeMapper, never()).insert(any());
        assertEquals(0, result.stationDelivered());
        assertEquals(1, result.archiveUserTargets());
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

    private void stubNotice(long id, String channels, int targetType, String targetIds) {
        SysNotice notice = new SysNotice();
        notice.setId(id);
        notice.setStatus(0);
        notice.setTitle("t");
        notice.setContent("c");
        notice.setChannels(channels);
        notice.setTargetType(targetType);
        notice.setTargetIds(targetIds);
        when(noticeMapper.selectById(id)).thenReturn(notice);
    }

    private void stubConsoleUser(String id, boolean eligible) {
        when(identityPort.lookupById(id)).thenReturn(Optional.of(new AdminConsolePrincipal(id, "login", "name", null)));
        when(identityPort.canAccessAdminConsole(id)).thenReturn(eligible);
    }
}
