package top.pxczxn.xingyu.community.support;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

/**
 * 发现页 keyset 游标编解码（Phase 5，2026-10-11）。
 *
 * <p>cursor = Base64URL(epochMilli + "|" + objectId)。非法/伪造 cursor 一律
 * 解码失败 → 由调用方回退首页（不抛 500——游标是透明的续读标记，不是权限边界）。
 */
public final class CursorCodec {

    private CursorCodec() {
    }

    public static String encode(Instant indexedAt, String objectId) {
        String raw = indexedAt.toEpochMilli() + "|" + objectId;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 解码失败返回 null（调用方回退首页），不抛异常。 */
    public static String[] decode(String cursor) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int split = raw.indexOf('|');
            if (split <= 0 || split == raw.length() - 1) {
                return null;
            }
            Long.parseLong(raw.substring(0, split)); // 校验可解析
            return new String[] { raw.substring(0, split), raw.substring(split + 1) };
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
