package top.pxczxn.xingyu;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.infra.schema.LegacyMigrationChecksums;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * legacy checksum 兼容映射的安全边界测试（纯单元测试，不启动 Spring 上下文、不连数据库）。
 *
 * <p>守的是这条底线：兼容只能是"登记在案的那一对确切取值"，不允许被放宽成
 * "忽略 checksum"或"允许任意旧版本 mismatch"。
 */
class LegacyMigrationChecksumsTest {

    /** 开发库 schema_migration 中 version=001 的历史 checksum（原始文件已丢失）。 */
    private static final String LEGACY_001 =
            "63a670b7132520cdded2be9d3ec22fa0be4971608d13abbf57207dc3f88abe78";

    /** 当前仓库恢复文件的固定 checksum（仓库规范 LF 字节，非某台机器的工作区字节）。 */
    private static final String CURRENT_001 =
            "8633753cbe3b80538fe17e34adc04e89923426c9ab545aebb38891921304f72b";

    private static final String V001_FILE = "V001__mars_base_schema_and_seed.sql";

    @Test
    @DisplayName("登记的取值本身就是约定的那一对，未被悄悄改动")
    void pinnedValuesAreExactlyAsSpecified() {
        assertEquals(LEGACY_001, LegacyMigrationChecksums.legacyChecksum("001"));
        assertEquals(CURRENT_001, LegacyMigrationChecksums.currentChecksum("001"));
    }

    @Test
    @DisplayName("历史 001 checksum 可以通过兼容判定")
    void legacy001ChecksumIsAccepted() {
        assertTrue(LegacyMigrationChecksums.isEquivalent("001", CURRENT_001, LEGACY_001),
                "台账为历史 001 checksum、当前文件为新固定 checksum 时，应视为同一历史迁移");
    }

    @Test
    @DisplayName("伪造的 001 checksum 必须失败")
    void forged001ChecksumMustFail() {
        // 台账值被伪造
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", CURRENT_001, "deadbeef".repeat(8)));
        // 当前文件值被伪造
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", "deadbeef".repeat(8), LEGACY_001));
        // 两边都不是登记值
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", "aaaa".repeat(16), "bbbb".repeat(16)));
        // 只差一个字符也不放行
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", CURRENT_001, LEGACY_001.replace("3", "4")));
        // 空值不放行
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", CURRENT_001, ""));
        assertFalse(LegacyMigrationChecksums.isEquivalent("001", null, LEGACY_001));
    }

    @Test
    @DisplayName("其他版本的 checksum mismatch 必须失败（含版本号为 001 的变体写法）")
    void otherVersionsMustFail() {
        assertNull(LegacyMigrationChecksums.legacyChecksum("002"));
        assertNull(LegacyMigrationChecksums.currentChecksum("002"));
        // 拿 001 的那对固定值去套别的版本号，必须不成立
        for (String version : new String[]{"000", "002", "019", "020", "040", "1", "01", "V001"}) {
            assertFalse(LegacyMigrationChecksums.isEquivalent(version, CURRENT_001, LEGACY_001),
                    "version=" + version + " 不应命中兼容映射");
            assertNull(LegacyMigrationChecksums.legacyChecksum(version));
            assertNull(LegacyMigrationChecksums.currentChecksum(version));
        }
    }

    @Test
    @DisplayName("版本号为空/null 时不放行")
    void nullOrBlankVersionMustFail() {
        assertNull(LegacyMigrationChecksums.legacyChecksum(null));
        assertNull(LegacyMigrationChecksums.currentChecksum(null));
        assertFalse(LegacyMigrationChecksums.isEquivalent(null, CURRENT_001, LEGACY_001));
        assertFalse(LegacyMigrationChecksums.isEquivalent("", CURRENT_001, LEGACY_001));
    }

    @Test
    @DisplayName("固定的新 checksum 与仓库中的 V001 文件实际内容一致（规范 LF 字节）")
    void pinnedCurrentChecksumMatchesRepositoryFile() throws IOException {
        Optional<Path> file = locateMigrationFile();
        assertTrue(file.isPresent(),
                "未能在工作目录上溯路径中找到 sql/" + V001_FILE + "（工作目录: "
                        + Paths.get(System.getProperty("user.dir")).toAbsolutePath() + "）");
        assertEquals(CURRENT_001, sha256(file.get()),
                "sql/" + V001_FILE + " 的内容与 LegacyMigrationChecksums 中固定的 checksum 不一致："
                        + "文件被修改后必须同步更新常量，否则开发库会因 checksum mismatch 启动失败");
    }

    @Test
    @DisplayName("所有迁移文件必须以仓库规范 LF 落盘（CRLF 会让 checksum 与台账失配）")
    void migrationFilesMustBeStoredWithLfLineEndings() throws IOException {
        Optional<Path> dir = locateMigrationDir();
        assertTrue(dir.isPresent(),
                "未能在工作目录上溯路径中找到 sql/ 目录（工作目录: "
                        + Paths.get(System.getProperty("user.dir")).toAbsolutePath() + "）");

        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.list(dir.get())) {
            for (Path path : paths
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().matches("V\\d+__.*\\.sql"))
                    .sorted()
                    .toList()) {
                if (containsCarriageReturn(path)) {
                    offenders.add(path.getFileName().toString());
                }
            }
        }

        assertTrue(offenders.isEmpty(),
                "以下迁移文件的工作区字节含 CR（CRLF 行尾），与仓库规范 LF 不一致：" + offenders
                        + "。迁移台账存的是文件原始字节的 sha256，CRLF 会导致同一份内容算出不同 checksum，"
                        + "在 Linux / CI 结出时与 Windows 工作区互相失配。"
                        + "修复方式：从规范 blob 重写工作区字节（git checkout -- <file> 或"
                        + " git show HEAD:<file> > <file>），不要把 CRLF/LF 归一化塞进 SchemaMigrator。");
    }

    private boolean containsCarriageReturn(Path path) throws IOException {
        for (byte b : Files.readAllBytes(path)) {
            if (b == '\r') {
                return true;
            }
        }
        return false;
    }

    private Optional<Path> locateMigrationFile() {
        return locateMigrationDir().map(dir -> dir.resolve(V001_FILE));
    }

    private Optional<Path> locateMigrationDir() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        for (int depth = 0; depth < 5 && current != null; depth++) {
            Path candidate = current.resolve("sql");
            if (Files.isDirectory(candidate)) {
                return Optional.of(candidate);
            }
            current = current.getParent();
        }
        return Optional.empty();
    }

    private String sha256(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(Files.readAllBytes(path)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
