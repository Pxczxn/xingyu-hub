package top.pxczxn.xingyu.crypto.engine;

import top.pxczxn.xingyu.crypto.protocol.CryptoAad;
import top.pxczxn.xingyu.crypto.protocol.CryptoEnvelope;
import top.pxczxn.xingyu.crypto.protocol.CryptoHeaders;
import top.pxczxn.xingyu.crypto.session.CryptoSessionKeyDeriver;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * XYC1 响应加密。
 */
public final class Xyc1ResponseCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    private Xyc1ResponseCipher() {
    }

    public static CryptoEnvelope encrypt(
            byte[] sessionMasterKey,
            String sessionId,
            String requestId,
            String jsonPlaintext
    ) {
        byte[] responseKey = CryptoSessionKeyDeriver.deriveResponseKey(sessionMasterKey, requestId);
        long ts = System.currentTimeMillis();
        byte[] aad = CryptoAad.build(sessionId, requestId, ts);
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(responseKey, "AES"), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            cipher.updateAAD(aad);
            byte[] ciphertext = cipher.doFinal(jsonPlaintext.getBytes(StandardCharsets.UTF_8));
            return CryptoEnvelope.builder()
                    .v(CryptoHeaders.PROTOCOL_VERSION)
                    .sid(sessionId)
                    .rid(requestId)
                    .alg(CryptoHeaders.ALGORITHM)
                    .ts(ts)
                    .nonce(Base64.getEncoder().encodeToString(iv))
                    .data(Base64.getEncoder().encodeToString(ciphertext))
                    .build();
        } catch (Exception e) {
            throw new IllegalStateException("XYC1 响应加密失败", e);
        }
    }
}
