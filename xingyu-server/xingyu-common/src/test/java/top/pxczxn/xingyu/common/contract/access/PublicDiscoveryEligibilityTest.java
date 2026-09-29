package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ObjectId;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicDiscoveryEligibilityTest {

    private static final ObjectId OWNER = ObjectId.random();

    @Test
    void publicPublishedEligible() {
        DiscoverableResource resource = DiscoverableResource.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.PUBLIC)
                .ownerActive(true)
                .resourceActive(true)
                .underReview(false)
                .governanceSuppressed(false)
                .hasPublishedRevision(true)
                .discoveryEligible(true)
                .build();
        assertTrue(PublicDiscoveryEligibility.isEligible(resource, AccessorContext.anonymous()));
    }

    @Test
    void privateNotEligibleForDiscovery() {
        DiscoverableResource resource = DiscoverableResource.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.PRIVATE)
                .ownerActive(true)
                .resourceActive(true)
                .underReview(false)
                .governanceSuppressed(false)
                .hasPublishedRevision(true)
                .discoveryEligible(true)
                .build();
        assertFalse(PublicDiscoveryEligibility.isEligible(resource, AccessorContext.anonymous()));
    }

    @Test
    void unpublishedNotEligible() {
        DiscoverableResource resource = DiscoverableResource.builder()
                .exists(true)
                .ownerId(OWNER)
                .visibility(Visibility.PUBLIC)
                .ownerActive(true)
                .resourceActive(true)
                .underReview(false)
                .governanceSuppressed(false)
                .hasPublishedRevision(false)
                .discoveryEligible(true)
                .build();
        assertFalse(PublicDiscoveryEligibility.isEligible(resource, AccessorContext.anonymous()));
    }
}
