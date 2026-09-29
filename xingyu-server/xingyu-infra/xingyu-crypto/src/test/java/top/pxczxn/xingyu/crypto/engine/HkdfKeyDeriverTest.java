package top.pxczxn.xingyu.crypto.engine;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

class HkdfKeyDeriverTest {

    @Test
    void deriveIsDeterministic() {
        byte[] ikm = "shared-secret-material".getBytes(StandardCharsets.UTF_8);
        byte[] salt = Base64.getDecoder().decode("c2FsdC1zYW1wbGU=");
        byte[] first = HkdfKeyDeriver.derive(ikm, salt, "xingyu-admin:session:v1", 32);
        byte[] second = HkdfKeyDeriver.derive(ikm, salt, "xingyu-admin:session:v1", 32);
        assertArrayEquals(first, second);
    }
}
