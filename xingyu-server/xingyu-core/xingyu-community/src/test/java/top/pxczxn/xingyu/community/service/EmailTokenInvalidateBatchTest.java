package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.mapper.EmailVerificationTokenMapper;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class EmailTokenInvalidateBatchTest {

    private final EmailVerificationTokenMapper tokens = mock(EmailVerificationTokenMapper.class);
    private final CommunityAccountService service = new CommunityAccountService(
            null, null, null, tokens, null, null,
            null, null, null, null, null, null, null, null, null, null);

    @Test
    void pendingTokensForOnePurposeAreConsumedOnce() {
        service.invalidatePendingTokens("me", "EMAIL_CHANGE");

        verify(tokens).consumePending(eq("me"), eq("EMAIL_CHANGE"), any(Instant.class));
        verify(tokens, never()).selectList(any());
        verify(tokens, never()).updateById(any());
        verify(tokens, never()).consumeOnce(any(), any());
    }
}
