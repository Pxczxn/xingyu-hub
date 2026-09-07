package top.pxczxn.xingyu.community.support;

import cn.hutool.crypto.digest.BCrypt;

public final class PasswordSupport {
    private PasswordSupport() {
    }

    public static String hash(String rawPassword) {
        return BCrypt.hashpw(rawPassword, BCrypt.gensalt());
    }

    public static boolean matches(String rawPassword, String hash) {
        return hash != null && BCrypt.checkpw(rawPassword, hash);
    }
}
