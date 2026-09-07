package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ObjectId;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DiscoverableResource {
    boolean exists;
    ObjectId ownerId;
    Visibility visibility;
    boolean ownerActive;
    boolean resourceActive;
    boolean underReview;
    boolean governanceSuppressed;
    boolean hasPublishedRevision;
    boolean discoveryEligible;

    public ResourceAccess toResourceAccess() {
        return ResourceAccess.builder()
                .exists(exists)
                .ownerId(ownerId)
                .visibility(visibility)
                .ownerActive(ownerActive)
                .resourceActive(resourceActive)
                .underReview(underReview)
                .governanceSuppressed(governanceSuppressed)
                .build();
    }
}
