package top.pxczxn.xingyu.crypto.protocol;

import java.nio.charset.StandardCharsets;

/**
 * AES-GCM AAD 编码（前后端必须一致）。
 * 格式：UTF-8 字符串 {@code XYC1|{sid}|{rid}|A256GCM|{ts}}
 */
public final class CryptoAad {

    private CryptoAad() {
    }

    public static byte[] build(String sid, String rid, long ts) {
        String aad = CryptoHeaders.PROTOCOL_VERSION + '|'
                + sid + '|'
                + rid + '|'
                + CryptoHeaders.ALGORITHM + '|'
                + ts;
        return aad.getBytes(StandardCharsets.UTF_8);
    }
}
