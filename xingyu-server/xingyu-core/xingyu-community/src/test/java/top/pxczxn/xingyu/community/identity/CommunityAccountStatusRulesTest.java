package top.pxczxn.xingyu.community.identity;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommunityAccountStatusRulesTest {

    @Test
    void activeUserIsAllowedWhenEmailNotRequired() {
        CommunityUser user = user("ACTIVE", null);
        assertEquals(CommunityLoginBlockReason.NONE, CommunityAccountStatusRules.evaluate(user, false));
        assertTrue(CommunityAccountStatusRules.readiness(user, false).allowed());
    }

    @Test
    void pendingReviewIsDistinct() {
        CommunityUser user = user("PENDING_REVIEW", Instant.now());
        assertEquals(CommunityLoginBlockReason.PENDING_REVIEW, CommunityAccountStatusRules.evaluate(user, true));
        ContractException ex = assertThrows(
                ContractException.class, () -> CommunityAccountStatusRules.throwIfCannotLogin(user, true));
        assertEquals(ErrorCode.AUTH_FORBIDDEN, ex.getErrorCode());
        assertEquals("账号正在审核中，请等待管理员审核通过后再登录", ex.getMessage());
    }

    @Test
    void rejectedIsDistinct() {
        CommunityUser user = user("REJECTED", Instant.now());
        assertEquals(CommunityLoginBlockReason.REJECTED, CommunityAccountStatusRules.evaluate(user, false));
        ContractException ex = assertThrows(
                ContractException.class, () -> CommunityAccountStatusRules.throwIfCannotLogin(user, false));
        assertEquals("注册申请未通过审核，如有疑问请联系管理员", ex.getMessage());
    }

    @Test
    void suspendedAndUnknownMapToSuspended() {
        assertEquals(
                CommunityLoginBlockReason.SUSPENDED,
                CommunityAccountStatusRules.evaluate(user("SUSPENDED", Instant.now()), false));
        assertEquals(
                CommunityLoginBlockReason.SUSPENDED,
                CommunityAccountStatusRules.evaluate(user("DELETED", Instant.now()), false));
        ContractException ex = assertThrows(
                ContractException.class,
                () -> CommunityAccountStatusRules.throwIfCannotLogin(user("SUSPENDED", Instant.now()), false));
        assertEquals(ErrorCode.ACCOUNT_SUSPENDED, ex.getErrorCode());
    }

    @Test
    void emailUnverifiedOnlyWhenConfigRequiresIt() {
        CommunityUser unverified = user("ACTIVE", null);
        assertEquals(
                CommunityLoginBlockReason.EMAIL_UNVERIFIED,
                CommunityAccountStatusRules.evaluate(unverified, true));
        assertEquals(CommunityLoginBlockReason.NONE, CommunityAccountStatusRules.evaluate(unverified, false));
        CommunityUser verified = user("ACTIVE", Instant.parse("2026-01-01T00:00:00Z"));
        assertEquals(CommunityLoginBlockReason.NONE, CommunityAccountStatusRules.evaluate(verified, true));
    }

    @Test
    void missingUserIsNotFoundAndDoesNotThrowOnLoginPath() {
        assertEquals(CommunityLoginBlockReason.NOT_FOUND, CommunityAccountStatusRules.evaluate(null, true));
        assertFalse(CommunityAccountStatusRules.readiness(null, true).allowed());
        CommunityAccountStatusRules.throwIfCannotLogin(null, true);
    }

    private static CommunityUser user(String status, Instant emailVerifiedAt) {
        CommunityUser user = new CommunityUser();
        user.setId("u1");
        user.setStatus(status);
        user.setEmailVerifiedAt(emailVerifiedAt);
        return user;
    }
}
