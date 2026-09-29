package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.ObjectId;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccessPolicyTest {

    private static final ObjectId OWNER = ObjectId.of("f37ad3a9-b5d7-4625-b7b9-189512886403");
    private static final ObjectId OTHER = ObjectId.of("01900000-0000-7000-8000-000000000001");

    @Test
    void privateResourceReturnsNotFoundForStranger() {
        ResourceAccess resource = ResourceAccess.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.PRIVATE)
                .ownerActive(true)
                .resourceActive(true)
                .build();
        AccessDecision decision = AccessPolicy.evaluate(resource, AccessorContext.authenticated(OTHER));
        assertFalse(decision.isAllowed());
        assertEquals(ErrorCode.NOT_FOUND, decision.getErrorCode());
    }

    @Test
    void unlistedAllowsDirectReadButNotDiscovery() {
        ResourceAccess resource = ResourceAccess.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.UNLISTED)
                .ownerActive(true)
                .resourceActive(true)
                .build();
        AccessDecision decision = AccessPolicy.evaluate(resource, AccessorContext.anonymous());
        assertTrue(decision.isAllowed());
        assertFalse(decision.isDiscoverable());
    }

    @Test
    void expiredSessionTreatedAsAnonymous() {
        ResourceAccess resource = ResourceAccess.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.PRIVATE)
                .ownerActive(true)
                .resourceActive(true)
                .build();
        AccessDecision decision = AccessPolicy.evaluate(resource, AccessorContext.expiredSession());
        assertFalse(decision.isAllowed());
        assertEquals(ErrorCode.NOT_FOUND, decision.getErrorCode());
    }
}
