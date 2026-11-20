package top.pxczxn.xingyu.system.util;

import java.util.OptionalLong;

/**
 * 当前会话 loginId 可能是社区 UUID，不能一律 {@code Long.parseLong}。
 */
public final class SaLoginIds {

    private SaLoginIds() {
    }

    public static OptionalLong asLongIfNumeric(Object loginId) {
        if (loginId == null) {
            return OptionalLong.empty();
        }
        String value = loginId.toString();
        if (value.isEmpty()) {
            return OptionalLong.empty();
        }
        int index = 0;
        if (value.charAt(0) == '-' && value.length() > 1) {
            index = 1;
        }
        for (int i = index; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch < '0' || ch > '9') {
                return OptionalLong.empty();
            }
        }
        try {
            return OptionalLong.of(Long.parseLong(value));
        } catch (NumberFormatException ex) {
            return OptionalLong.empty();
        }
    }
}
