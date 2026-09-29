package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ObjectId;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ResourceAccess {
    boolean exists;
    ObjectId ownerId;
    Visibility visibility;
    boolean ownerActive;
    boolean resourceActive;
    boolean underReview;
    boolean governanceSuppressed;
}
