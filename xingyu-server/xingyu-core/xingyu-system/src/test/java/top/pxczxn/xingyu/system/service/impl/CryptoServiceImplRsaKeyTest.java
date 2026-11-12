package top.pxczxn.xingyu.system.service.impl;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.util.RsaUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CryptoServiceImplRsaKeyTest {

    @Test
    void placeholderPrivateKeyIsNotUsable() {
        assertFalse(CryptoServiceImpl.isUsableRsaPrivateKey(null));
        assertFalse(CryptoServiceImpl.isUsableRsaPrivateKey(""));
        assertFalse(CryptoServiceImpl.isUsableRsaPrivateKey("__REDACTED__"));
    }

    @Test
    void generatedKeyPairCanRoundTripAdminPassword() throws Exception {
        Map<String, String> pair = RsaUtils.generateKeyPair();
        String privateKey = pair.get(RsaUtils.PRIVATE_KEY);
        String publicKey = pair.get(RsaUtils.PUBLIC_KEY);

        assertTrue(CryptoServiceImpl.isUsableRsaPrivateKey(privateKey));
        String encrypted = RsaUtils.encryptByPublicKey("admin123", publicKey);
        assertEquals("admin123", RsaUtils.decryptByPrivateKey(encrypted, privateKey));
    }
}
