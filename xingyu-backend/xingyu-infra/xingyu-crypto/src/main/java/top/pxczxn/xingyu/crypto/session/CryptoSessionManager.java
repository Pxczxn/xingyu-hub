package top.pxczxn.xingyu.crypto.session;

import java.util.Optional;

/**
 * Crypto Session 内存存储。
 */
public interface CryptoSessionManager {

    void save(String sessionId, byte[] masterKey, long expiresAt);

    Optional<CryptoSession> get(String sessionId);

    void invalidate(String sessionId);
}
