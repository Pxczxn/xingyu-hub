package top.pxczxn.xingyu.oss;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * 把相对对象键解析到存储根目录内，拒绝绝对路径、{@code ..} 和符号链接逃逸。
 */
public final class StoragePaths {

    private StoragePaths() {}

    public static Path resolveInsideRoot(String basePath, String... relativeParts) {
        Path root = absoluteRoot(basePath);
        List<String> segments = segmentsOf(relativeParts);
        Path lexical = root;
        for (String segment : segments) {
            lexical = lexical.resolve(segment).normalize();
        }
        if (!lexical.startsWith(root)) {
            throw new StoragePathException();
        }
        assertRealPathInside(root, segments);
        return lexical;
    }

    public static String normalizeRelative(String path) {
        return String.join("/", segmentsOf(path));
    }

    private static Path absoluteRoot(String basePath) {
        if (basePath == null || basePath.isBlank()) {
            throw new StoragePathException();
        }
        return Paths.get(basePath).toAbsolutePath().normalize();
    }

    private static List<String> segmentsOf(String... relativeParts) {
        if (relativeParts == null || relativeParts.length == 0) {
            throw new StoragePathException();
        }
        List<String> segments = new ArrayList<>();
        for (String part : relativeParts) {
            if (part == null) {
                throw new StoragePathException();
            }
            String normalized = part.replace('\\', '/').trim();
            if (normalized.isEmpty() || normalized.startsWith("/") || isAbsolute(normalized)) {
                throw new StoragePathException();
            }
            for (String segment : normalized.split("/")) {
                if (segment.isEmpty() || ".".equals(segment)) {
                    continue;
                }
                if ("..".equals(segment) || segment.indexOf('\0') >= 0) {
                    throw new StoragePathException();
                }
                segments.add(segment);
            }
        }
        if (segments.isEmpty()) {
            throw new StoragePathException();
        }
        return segments;
    }

    private static boolean isAbsolute(String normalized) {
        return normalized.startsWith("//")
                || (normalized.length() >= 2
                && Character.isLetter(normalized.charAt(0))
                && normalized.charAt(1) == ':');
    }

    private static void assertRealPathInside(Path root, List<String> segments) {
        Path realRoot;
        try {
            realRoot = Files.exists(root) ? root.toRealPath() : root;
        } catch (IOException ex) {
            throw new StoragePathException();
        }
        Path cursor = realRoot;
        for (String segment : segments) {
            cursor = cursor.resolve(segment);
            if (!Files.exists(cursor)) {
                return;
            }
            try {
                Path real = cursor.toRealPath();
                if (!real.startsWith(realRoot)) {
                    throw new StoragePathException();
                }
                cursor = real;
            } catch (StoragePathException ex) {
                throw ex;
            } catch (IOException ex) {
                throw new StoragePathException();
            }
        }
    }
}
