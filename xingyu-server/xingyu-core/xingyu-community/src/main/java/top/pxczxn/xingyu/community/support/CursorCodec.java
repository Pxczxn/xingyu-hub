package top.pxczxn.xingyu.community.support;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

/**
 * 发现页 keyset 游标编解码（Phase 5.1，2026-10-11）。
 *
 * <p>cursor = Base64URL(objectType + SEP + epochMilli + SEP + objectId)。
 * 三元组保证全序：search_document 的唯一键是 (object_type, object_id)，
 * object_id 单独不唯一（同一 id 可同时存在 ARTICLE 与 SERIES 文档）。
 * 分隔符用 \u0001（内容与 id 不可能包含的控制字符），杜绝注入歧义。
 *
 * <p>非法/伪造 cursor 解码失败 → 调用方返回 400（明确客户端错误，不静默回首页）。
 */
public final class CursorCodec {

    private static final String SEP = "\u0001";

    private CursorCodec() {
    }

    public static String encode(String objectType, Instant indexedAt, String objectId) {
        String raw = objectType + SEP + indexedAt.toEpochMilli() + SEP + objectId;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** 解码失败返回 null（调用方抛 400），不抛异常。 */
    public static String[] decode(String cursor) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = raw.split(SEP, -1);
            if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
                return null;
            }
            Long.parseLong(parts[1]); // 校验时间戳可解析
            return parts;
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
