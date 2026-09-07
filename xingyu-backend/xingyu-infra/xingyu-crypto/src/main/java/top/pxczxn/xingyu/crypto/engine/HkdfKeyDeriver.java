package top.pxczxn.xingyu.crypto.engine;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

/**
 * HKDF-SHA256（RFC 5869）。
 */
public final class HkdfKeyDeriver {

    private static final int HASH_LEN = 32;

    private HkdfKeyDeriver() {
    }

    public static byte[] derive(byte[] ikm, byte[] salt, String info, int length) {
        try {
            byte[] prk = extract(ikm, salt);
            return expand(prk, info, length);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HKDF 派生失败", e);
        }
    }

    private static byte[] extract(byte[] ikm, byte[] salt) throws GeneralSecurityException {
        byte[] actualSalt = salt != null && salt.length > 0 ? salt : new byte[HASH_LEN];
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(actualSalt, "HmacSHA256"));
        return mac.doFinal(ikm);
    }

    private static byte[] expand(byte[] prk, String info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        byte[] infoBytes = info.getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[length];
        byte[] previous = new byte[0];
        int offset = 0;
        byte counter = 1;
        while (offset < length) {
            mac.reset();
            mac.init(new SecretKeySpec(prk, "HmacSHA256"));
            mac.update(previous);
            mac.update(infoBytes);
            mac.update(counter);
            previous = mac.doFinal();
            int copyLen = Math.min(previous.length, length - offset);
            System.arraycopy(previous, 0, result, offset, copyLen);
            offset += copyLen;
            counter++;
        }
        return result;
    }
}
