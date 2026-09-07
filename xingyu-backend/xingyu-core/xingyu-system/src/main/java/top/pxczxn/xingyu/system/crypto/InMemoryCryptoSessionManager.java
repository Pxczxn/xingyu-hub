package top.pxczxn.xingyu.system.crypto;

import org.springframework.stereotype.Component;
import top.pxczxn.xingyu.crypto.session.CryptoSession;
import top.pxczxn.xingyu.crypto.session.CryptoSessionManager;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 单实例内存 Crypto Session 存储。
 */
@Component
public class InMemoryCryptoSessionManager implements CryptoSessionManager {

    private final Map<String, CryptoSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void save(String sessionId, byte[] masterKey, long expiresAt) {
        sessions.put(sessionId, new CryptoSession(sessionId, masterKey, expiresAt));
    }

    @Override
    public Optional<CryptoSession> get(String sessionId) {
        CryptoSession session = sessions.get(sessionId);
        if (session == null) {
            return Optional.empty();
        }
        if (session.isExpired()) {
            sessions.remove(sessionId);
            return Optional.empty();
        }
        return Optional.of(session);
    }

    @Override
    public void invalidate(String sessionId) {
        sessions.remove(sessionId);
    }
}
