package top.pxczxn.xingyu.community.identity;

public record CommunityLoginReadiness(boolean allowed, CommunityLoginBlockReason reason) {

    public static CommunityLoginReadiness ok() {
        return new CommunityLoginReadiness(true, CommunityLoginBlockReason.NONE);
    }

    public static CommunityLoginReadiness blocked(CommunityLoginBlockReason reason) {
        return new CommunityLoginReadiness(false, reason);
    }
}
