package top.pxczxn.xingyu.oss;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class LocalFileStoragePathTest {

    @TempDir
    Path root;

    @TempDir
    Path outside;

    @Test
    void normalRelativePathUploadsReadsAndDeletes() throws Exception {
        LocalFileStorage storage = storage();
        byte[] payload = "avatar".getBytes(StandardCharsets.UTF_8);

        String url = storage.upload(new ByteArrayInputStream(payload), "public/avatars", "a.png");

        assertEquals("/api/v1/admin/files/public/avatars/a.png", url);
        assertArrayEquals(payload, storage.getFile("public/avatars/a.png"));
        assertTrue(storage.exists("public/avatars/a.png"));
        storage.delete("public/avatars/a.png");
        assertFalse(storage.exists("public/avatars/a.png"));
    }

    @Test
    void traversalAndAbsolutePathsAreRejectedWithoutLeakingLocation() throws Exception {
        LocalFileStorage storage = storage();
        Files.writeString(outside.resolve("secret.txt"), "secret");

        assertRejected(() -> storage.getFile("../" + outside.getFileName() + "/secret.txt"));
        assertRejected(() -> storage.upload(new ByteArrayInputStream(new byte[] {1}), "..", "secret.txt"));
        assertRejected(() -> storage.delete("../secret.txt"));
        assertRejected(() -> storage.getFile(outside.resolve("secret.txt").toString()));
        assertRejected(() -> storage.getUrl("../../etc/passwd"));
        assertTrue(Files.exists(outside.resolve("secret.txt")));
    }

    @Test
    void linkEscapeIsRejected() throws Exception {
        Files.writeString(outside.resolve("secret.txt"), "secret");
        Path link = root.resolve("escape");
        if (!linkTo(link, outside)) {
            fail("无法创建用于逃逸测试的符号链接或目录联接");
        }
        LocalFileStorage storage = storage();

        assertRejected(() -> storage.getFile("escape/secret.txt"));
        assertRejected(() -> storage.delete("escape/secret.txt"));
        assertEquals("secret", Files.readString(outside.resolve("secret.txt")));
    }

    private LocalFileStorage storage() {
        LocalFileStorage storage = new LocalFileStorage();
        storage.init(root.toString(), "");
        return storage;
    }

    private static void assertRejected(org.junit.jupiter.api.function.Executable executable) {
        StoragePathException ex = assertThrows(StoragePathException.class, executable);
        assertEquals(StoragePathException.MESSAGE, ex.getMessage());
        assertFalse(ex.getMessage().contains(":\\") || ex.getMessage().contains("/tmp"));
    }

    private static boolean linkTo(Path link, Path target) throws Exception {
        try {
            Files.createSymbolicLink(link, target);
            return true;
        } catch (Exception ignored) {
            Process process = new ProcessBuilder(
                    "cmd", "/c", "mklink", "/J", link.toString(), target.toString())
                    .redirectErrorStream(true)
                    .start();
            process.waitFor(10, TimeUnit.SECONDS);
            return process.exitValue() == 0 && Files.exists(link);
        }
    }
}
