package top.pxczxn.xingyu.crypto.session;

import lombok.Getter;

/**
 * 服务端内存中的 Crypto Session。
 */
@Getter
public class CryptoSession {

    private final String sessionId;
    private final byte[] masterKey;
    private final long expiresAt;

    public CryptoSession(String sessionId, byte[] masterKey, long expiresAt) {
        this.sessionId = sessionId;
        this.masterKey = masterKey;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
        return System.currentTimeMillis() > expiresAt;
    }
}
