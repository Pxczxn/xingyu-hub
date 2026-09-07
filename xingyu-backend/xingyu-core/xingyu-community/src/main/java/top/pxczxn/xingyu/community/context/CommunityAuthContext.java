package top.pxczxn.xingyu.community.context;

import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import lombok.Getter;
import lombok.Setter;

import java.util.Optional;

public final class CommunityAuthContext {
    private static final ThreadLocal<Holder> HOLDER = new ThreadLocal<>();

    private CommunityAuthContext() {
    }

    public static void set(CommunityUser user, CommunitySession session) {
        Holder holder = new Holder();
        holder.user = user;
        holder.session = session;
        HOLDER.set(holder);
    }

    public static CommunityUser requireUser() {
        Holder holder = HOLDER.get();
        if (holder == null || holder.user == null) {
            throw new IllegalStateException("No community user in context");
        }
        return holder.user;
    }

    public static Optional<CommunityUser> currentUser() {
        Holder holder = HOLDER.get();
        if (holder == null || holder.user == null) {
            return Optional.empty();
        }
        return Optional.of(holder.user);
    }

    public static CommunitySession requireSession() {
        Holder holder = HOLDER.get();
        if (holder == null || holder.session == null) {
            throw new IllegalStateException("No community session in context");
        }
        return holder.session;
    }

    public static void clear() {
        HOLDER.remove();
    }

    @Getter
    @Setter
    private static class Holder {
        private CommunityUser user;
        private CommunitySession session;
    }
}
