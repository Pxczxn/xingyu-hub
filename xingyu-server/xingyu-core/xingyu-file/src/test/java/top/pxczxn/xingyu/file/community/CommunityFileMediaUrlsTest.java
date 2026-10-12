package top.pxczxn.xingyu.file.community;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;

class CommunityFileMediaUrlsTest {

    @Test
    void extractsAndReplacesPrivateUrls() {
        String md = "![a](/api/v1/media/private/42) and /api/v1/media/private/99";
        assertIterableEquals(List.of(42L, 99L), CommunityFileMediaUrls.extractPrivateFileIds(md));
        assertEquals(
                "![a](/api/v1/media/public/42) and /api/v1/media/public/99",
                CommunityFileMediaUrls.replacePrivateWithPublic(md));
    }
}
