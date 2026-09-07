package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ObjectId;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AccessorContext {
    ObjectId userId;
    boolean sessionActive;

    public static AccessorContext anonymous() {
        return AccessorContext.builder().sessionActive(false).build();
    }

    public static AccessorContext authenticated(ObjectId userId) {
        return AccessorContext.builder().userId(userId).sessionActive(true).build();
    }

    public static AccessorContext expiredSession() {
        return anonymous();
    }

    public boolean isOwner(ObjectId ownerId) {
        return userId != null && ownerId != null && userId.equals(ownerId);
    }
}
