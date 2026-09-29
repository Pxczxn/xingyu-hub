package top.pxczxn.xingyu.crypto.session;

import top.pxczxn.xingyu.crypto.engine.HkdfKeyDeriver;
import top.pxczxn.xingyu.crypto.protocol.CryptoHeaders;

/**
 * 从 ECDH 共享秘密或 sessionMasterKey 派生对称密钥。
 */
public final class CryptoSessionKeyDeriver {

    private static final int KEY_LENGTH = 32;

    private CryptoSessionKeyDeriver() {
    }

    public static byte[] deriveSessionMasterKey(byte[] sharedSecret, byte[] salt) {
        return HkdfKeyDeriver.derive(sharedSecret, salt, CryptoHeaders.SESSION_INFO, KEY_LENGTH);
    }

    public static byte[] deriveResponseKey(byte[] sessionMasterKey, String requestId) {
        return HkdfKeyDeriver.derive(
                sessionMasterKey,
                null,
                CryptoHeaders.RESPONSE_INFO_PREFIX + requestId,
                KEY_LENGTH
        );
    }
}
