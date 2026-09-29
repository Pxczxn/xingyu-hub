package top.pxczxn.xingyu;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 静态守卫：测试源码中不得出现任何 schema 修改语句。
 *
 * <p>背景：历史上 {@code CommunityTestSupport.ensureGrowthSchema} /
 * {@code ensureSocialGapSchema} 以及若干集成测试用 {@code CREATE TABLE IF NOT EXISTS} /
 * {@code ALTER TABLE ADD COLUMN} 在测试启动时"顺手"把表补上。后果是结构缺失被静默掩盖：
 * 测试全绿，但库结构已偏离 migration baseline（开发库的索引与注释漂移正是这么产生的）。
 *
 * <p>这类代码很容易被"为了让测试跑通"再次写回来，所以用一条静态扫描把它钉死：
 * 测试源码里出现任何建表/改表语句，本测试立即失败。需要结构时应当
 * <b>修迁移并运行 {@code sql/rebuild-test-db.sh} 重建</b>，或调用
 * {@link TestSchemaAssertions} 做只读断言。
 */
class TestSourceSchemaMutationGuardTest {

    /** 本文件自身需要书写这些关键字（模式定义与反证用例），因此从扫描中排除。 */
    private static final String SELF_FILE_NAME = "TestSourceSchemaMutationGuardTest.java";

    /** 被禁止的 schema 修改语句。 */
    private static final Pattern FORBIDDEN_SCHEMA_DDL = Pattern.compile(
            "(CREATE\\s+(TABLE|INDEX|UNIQUE\\s+INDEX|FULLTEXT\\s+INDEX)"
                    + "|ALTER\\s+TABLE"
                    + "|DROP\\s+(TABLE|INDEX)"
                    + "|RENAME\\s+TABLE"
                    + "|TRUNCATE\\s+TABLE"
                    + "|ADD\\s+COLUMN"
                    + "|MODIFY\\s+COLUMN"
                    + "|CHANGE\\s+COLUMN"
                    + "|ADD\\s+(UNIQUE\\s+)?KEY\\b"
                    + "|ADD\\s+CONSTRAINT)",
            Pattern.CASE_INSENSITIVE);

    @Test
    @DisplayName("测试源码中不存在建表/改表语句（防止 schema 自愈代码被写回）")
    void testSourcesMustNotContainSchemaMutations() throws IOException {
        Path testSourceRoot = locateTestSourceRoot();
        List<String> offenders = new ArrayList<>();
        List<Path> scanned = new ArrayList<>();

        try (Stream<Path> paths = Files.walk(testSourceRoot)) {
            for (Path path : paths
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".java"))
                    .filter(p -> !SELF_FILE_NAME.equals(p.getFileName().toString()))
                    .sorted()
                    .toList()) {
                scanned.add(path);
                collectOffenders(path, testSourceRoot, offenders);
            }
        }

        assertTrue(scanned.size() >= 10,
                "扫描到的测试源码文件过少（" + scanned.size() + " 个），"
                        + "疑似测试源码路径定位错误，守卫会形同虚设：" + testSourceRoot);

        assertTrue(offenders.isEmpty(),
                """
                        测试源码中出现了 schema 修改语句，共 %d 处：
                        %s
                        集成测试不得创建/修改表、列或索引：结构缺失必须通过修迁移并运行
                        `bash sql/rebuild-test-db.sh` 重建测试库来解决；结构是否正确请用
                        TestSchemaAssertions 做只读断言。
                        这样要求的理由是：测试侧自愈会造成"测试全绿但库结构已偏离 baseline"的假绿，
                        开发库的索引/注释漂移正是这么来的。
                        """.formatted(offenders.size(), String.join("\n", offenders)));
    }

    @Test
    @DisplayName("反证：守卫本身确实能识别被禁止的语句，不是空规则")
    void detectorItselfIsEffective() {
        // 必须被识别（真实历史代码形态）
        assertTrue(isForbidden("jdbcTemplate.execute(\"CREATE TABLE IF NOT EXISTS `user_block` (id varchar(36))\");"));
        assertTrue(isForbidden("jdbc.execute(\"ALTER TABLE `galaxy` ADD COLUMN `join_mode` varchar(32)\");"));
        assertTrue(isForbidden("jdbcTemplate.execute(\"DROP TABLE `x`\");"));
        assertTrue(isForbidden("stmt.execute(\"CREATE UNIQUE INDEX uk_x ON t (a)\");"));

        // 不得误报
        assertFalse(isForbidden("// 历史写法：CREATE TABLE IF NOT EXISTS x"));
        assertFalse(isForbidden("/* ALTER TABLE x ADD COLUMN y */"));
        assertFalse(isForbidden("jdbcTemplate.queryForList(\"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_NAME = ?\");"));
        assertFalse(isForbidden("String url = \"http://localhost:7779/api/v1\";"));

        // 跨行 javadoc：块注释状态必须跨行保持（这正是仓库里注释提到 ALTER TABLE 的真实形态）
        boolean[] inBlockComment = {false};
        assertFalse(isForbidden("    /**", inBlockComment));
        assertFalse(isForbidden(" * 结构不对就失败，而不是用 {@code CREATE TABLE IF NOT EXISTS} 兜底", inBlockComment));
        assertFalse(isForbidden(" * {@code ALTER TABLE} 悄悄把表补上。", inBlockComment));
        assertFalse(isForbidden("     */", inBlockComment));
        assertFalse(inBlockComment[0], "块注释闭合后状态应复位");

        // 块注释结束后，同一行里的真实语句仍必须被抓住
        assertTrue(isForbidden("/* 说明 */ jdbc.execute(\"DROP TABLE `y`\");"));
    }

    private void collectOffenders(Path file, Path testSourceRoot, List<String> offenders) throws IOException {
        List<String> lines = Files.readAllLines(file);
        boolean[] inBlockComment = {false};
        for (int i = 0; i < lines.size(); i++) {
            if (isForbidden(lines.get(i), inBlockComment)) {
                offenders.add("  - " + testSourceRoot.relativize(file)
                        + ":" + (i + 1) + " -> " + describeMatch(lines.get(i)));
            }
        }
    }

    /** 判定单行源码（含跨行块注释状态）是否含被禁止语句：与正式扫描走同一条管线。 */
    private boolean isForbidden(String line, boolean[] inBlockComment) {
        return FORBIDDEN_SCHEMA_DDL.matcher(stripComments(line, inBlockComment)).find();
    }

    /** 单行判定（自证用例使用；块注释状态独立）。 */
    private boolean isForbidden(String line) {
        return isForbidden(line, new boolean[]{false});
    }

    private String describeMatch(String line) {
        Matcher matcher = FORBIDDEN_SCHEMA_DDL.matcher(stripComments(line, new boolean[]{false}));
        return matcher.find() ? matcher.group() : line.trim();
    }

    /**
     * 去掉单行注释、块注释（含跨行），只保留"可能被执行的代码文本"。
     *
     * <p>只删减不新增，因此最多造成漏报、不会造成误报。{@code //} 仅在被空白或行首前置时
     * 才视作注释起始，避免把 {@code "http://..."} 这类字面量误当注释而漏扫其后内容。
     */
    private String stripComments(String line, boolean[] inBlockComment) {
        StringBuilder result = new StringBuilder();
        int index = 0;
        while (index < line.length()) {
            if (inBlockComment[0]) {
                int end = line.indexOf("*/", index);
                if (end < 0) {
                    return result.toString();
                }
                inBlockComment[0] = false;
                index = end + 2;
                continue;
            }
            int blockStart = line.indexOf("/*", index);
            int lineCommentStart = -1;
            for (int probe = line.indexOf("//", index); probe >= 0; probe = line.indexOf("//", probe + 1)) {
                if (probe == 0 || Character.isWhitespace(line.charAt(probe - 1))) {
                    lineCommentStart = probe;
                    break;
                }
            }
            if (lineCommentStart >= 0 && (blockStart < 0 || lineCommentStart < blockStart)) {
                result.append(line, index, lineCommentStart);
                return result.toString();
            }
            if (blockStart >= 0) {
                result.append(line, index, blockStart);
                inBlockComment[0] = true;
                index = blockStart + 2;
                continue;
            }
            result.append(line, index, line.length());
            break;
        }
        return result.toString();
    }

    /**
     * 定位 {@code src/test/java} 根目录。
     *
     * <p>找不到时直接失败：守门测试绝不能"因为找不到源码而静默通过"。
     */
    private Path locateTestSourceRoot() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        for (int depth = 0; depth < 6 && current != null; depth++) {
            Path candidate = current.resolve("src").resolve("test").resolve("java");
            if (Files.isDirectory(candidate)) {
                return candidate;
            }
            current = current.getParent();
        }
        throw new IllegalStateException(
                "未能定位 src/test/java（工作目录: " + Paths.get(System.getProperty("user.dir")).toAbsolutePath()
                        + "）。守卫无法扫描源码时不允许静默通过。");
    }
}
