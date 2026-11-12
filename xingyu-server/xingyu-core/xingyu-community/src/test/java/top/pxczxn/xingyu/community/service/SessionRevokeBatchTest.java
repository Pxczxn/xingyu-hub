package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunitySessionMapper;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class SessionRevokeBatchTest {

    private final CommunitySessionMapper sessions = mock(CommunitySessionMapper.class);
    private final CommunityAccountService service = new CommunityAccountService(
            null, null, null, null, null, sessions,
            null, null, null, null, null, null, null, null, null, null);

    @Test
    void revokeOtherSessionsUpdatesOnceAndLeavesTheCurrentToken() {
        service.revokeOtherSessions(user("me"), "current-token");

        verify(sessions).revokeOtherSessions(eq("me"), eq("current-token"), any(Instant.class));
        verify(sessions, never()).listByUserId(any());
        verify(sessions, never()).updateById(any());
        verify(sessions, never()).revokeActiveSessions(any(), any());
    }

    @Test
    void revokeActiveSessionsUpdatesOnce() {
        service.revokeActiveSessions("me");

        verify(sessions).revokeActiveSessions(eq("me"), any(Instant.class));
        verify(sessions, never()).listByUserId(any());
        verify(sessions, never()).updateById(any());
        verify(sessions, never()).revokeOtherSessions(any(), any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }
}
