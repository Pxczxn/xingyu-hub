package top.pxczxn.xingyu.system.crypto;

import lombok.Builder;
import lombok.Data;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.crypto.engine.EcdhKeyExchange;
import top.pxczxn.xingyu.crypto.protocol.CryptoHeaders;
import top.pxczxn.xingyu.crypto.session.CryptoSessionKeyDeriver;
import top.pxczxn.xingyu.crypto.session.CryptoSessionManager;

import java.security.KeyPair;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * Crypto Session 握手与生命周期。
 */
@Service
public class CryptoSessionService {

    private static final long SESSION_TTL_MILLIS = 30L * 60L * 1000L;
    private static final int SALT_LENGTH = 16;

    private final CryptoSessionManager sessionManager;
    private final SecureRandom secureRandom = new SecureRandom();

    public CryptoSessionService(CryptoSessionManager sessionManager) {
        this.sessionManager = sessionManager;
    }

    public HandshakeResult handshake(String clientPublicKeyBase64) {
        if (clientPublicKeyBase64 == null || clientPublicKeyBase64.isBlank()) {
            throw new IllegalArgumentException("clientPublicKey 不能为空");
        }
        byte[] salt = new byte[SALT_LENGTH];
        secureRandom.nextBytes(salt);
        KeyPair serverKeyPair = EcdhKeyExchange.generateKeyPair();
        byte[] clientSpki = EcdhKeyExchange.decodePublicKey(clientPublicKeyBase64.trim());
        byte[] sharedSecret = EcdhKeyExchange.deriveSharedSecret(serverKeyPair.getPrivate(), clientSpki);
        byte[] masterKey = CryptoSessionKeyDeriver.deriveSessionMasterKey(sharedSecret, salt);
        String sessionId = UUID.randomUUID().toString();
        long expiresAt = System.currentTimeMillis() + SESSION_TTL_MILLIS;
        sessionManager.save(sessionId, masterKey, expiresAt);
        return HandshakeResult.builder()
                .sessionId(sessionId)
                .serverPublicKey(EcdhKeyExchange.encodePublicKey(serverKeyPair.getPublic()))
                .salt(Base64.getEncoder().encodeToString(salt))
                .expiresAt(expiresAt)
                .protocol(CryptoHeaders.PROTOCOL_VERSION)
                .build();
    }

    public void invalidate(String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            sessionManager.invalidate(sessionId.trim());
        }
    }

    @Data
    @Builder
    public static class HandshakeResult {
        private String sessionId;
        private String serverPublicKey;
        private String salt;
        private long expiresAt;
        private String protocol;
    }
}
