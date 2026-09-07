package top.pxczxn.xingyu.community.context;

import top.pxczxn.xingyu.community.entity.CommunityApiToken;
import top.pxczxn.xingyu.community.entity.CommunityUser;

public final class CommunityOpenApiContext {

    private static final ThreadLocal<Holder> HOLDER = new ThreadLocal<>();

    private CommunityOpenApiContext() {
    }

    public static void set(CommunityUser user, CommunityApiToken token) {
        HOLDER.set(new Holder(user, token));
    }

    public static CommunityUser requireUser() {
        Holder holder = HOLDER.get();
        if (holder == null || holder.user == null) {
            throw new IllegalStateException("开放 API 未认证");
        }
        return holder.user;
    }

    public static CommunityApiToken requireToken() {
        Holder holder = HOLDER.get();
        if (holder == null || holder.token == null) {
            throw new IllegalStateException("开放 API 未认证");
        }
        return holder.token;
    }

    public static void clear() {
        HOLDER.remove();
    }

    private record Holder(CommunityUser user, CommunityApiToken token) {
    }
}
