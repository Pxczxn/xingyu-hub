package top.pxczxn.xingyu.crypto.engine;

import javax.crypto.KeyAgreement;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * ECDH P-256 密钥交换。
 */
public final class EcdhKeyExchange {

    private static final String CURVE = "secp256r1";

    private EcdhKeyExchange() {
    }

    public static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec(CURVE), new SecureRandom());
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("生成 ECDH 密钥对失败", e);
        }
    }

    public static byte[] deriveSharedSecret(PrivateKey privateKey, byte[] peerPublicKeySpki) {
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("EC");
            PublicKey peerPublicKey = keyFactory.generatePublic(new X509EncodedKeySpec(peerPublicKeySpki));
            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(privateKey);
            agreement.doPhase(peerPublicKey, true);
            return agreement.generateSecret();
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("ECDH 协商失败", e);
        }
    }

    public static String encodePublicKey(PublicKey publicKey) {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }

    public static byte[] decodePublicKey(String base64Spki) {
        return Base64.getDecoder().decode(base64Spki);
    }
}
