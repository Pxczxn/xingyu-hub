package top.pxczxn.xingyu.infra.schema;

import java.util.Map;

/**
 * 历史迁移 checksum 兼容映射（精确匹配，仅登记在案者生效）。
 *
 * <p>背景：{@code V001__mars_base_schema_and_seed.sql} 的原始文件已从仓库、Git 全历史、
 * IDE 本地历史、回收站与所有备份中丢失，但开发库 {@code schema_migration} 仍保留其历史记录
 * （version=001 / status=SUCCESS / 原始 checksum）。现行文件是按该次实际执行记录（MySQL binlog
 * 2026-08-26 批次）恢复的等价迁移，因此文件 checksum 必然与历史台账值不同。
 *
 * <p>为避免"文件与台账不一致即启动失败"，这里为 **且仅为 version=001** 登记一对固定的
 * checksum：只有当"台账现存值 == 已登记的历史 checksum"**并且**"当前文件的实际 checksum ==
 * 已固定的新 checksum"同时成立时，才把两者视为同一次历史迁移。
 *
 * <p>不做任何宽松处理：不做"忽略 checksum"、不为其他版本开口子、不接受登记值之外的任何取值。
 * 任何未登记的 version 或取值不匹配，一律继续由调用方 fail-fast。
 *
 * <p>维护约束：若 {@code sql/V001__mars_base_schema_and_seed.sql} 内容发生变化，
 * {@link #currentChecksum(String)} 的取值必须同步更新（自动化测试会校验二者一致）。
 *
 * <p><b>校验口径必须是"仓库规范字节"，而不是"某台机器的工作区字节"。</b>
 * {@link SchemaMigrator} 按文件原始字节做 sha256，因此工作区落盘的行尾符会直接改变
 * 计算结果：同一份内容以 LF 落盘与以 CRLF 落盘会得到两个不同的 checksum。
 * 迁移文件在版本库中的规范形式统一为 <b>LF</b>（见仓库根目录 {@code .gitattributes}），
 * 所以此处登记的 {@code CURRENT_CHECKSUMS} 一律取<b>规范 LF 内容</b>的哈希。
 *
 * <p>历史事故：该常量曾登记成某台 Windows 机器上 CRLF 工作区的哈希，导致同一份迁移
 * 在 Linux / CI 结出（LF）时 {@link #isEquivalent} 必然失配、{@code SchemaMigrator} 对
 * version=001 fail-fast。请勿再次把工作区字节当成规范字节。
 *
 * <p>替代方案（已否决）：不要改成"把 CRLF/LF 归一化后再比对"。台账里存的是各版本
 * <b>历史原始字节</b>的 checksum，统一归一化会同时改变所有版本的 checksum 语义，
 * 相当于一次全局的兼容性破坏。正确做法是保证迁移文件自身的规范字节稳定。
 */
public final class LegacyMigrationChecksums {

    /** version -> 已丢失的原始文件 checksum（数据库中已落库的历史值，来自 dev schema_migration）。 */
    private static final Map<String, String> LEGACY_CHECKSUMS = Map.of(
            "001", "63a670b7132520cdded2be9d3ec22fa0be4971608d13abbf57207dc3f88abe78");

    /**
     * version -> 当前仓库恢复文件的固定 checksum，取<b>仓库规范 LF 字节</b>
     * （sha256 of {@code git show HEAD:sql/V001__mars_base_schema_and_seed.sql}）。
     */
    private static final Map<String, String> CURRENT_CHECKSUMS = Map.of(
            "001", "8633753cbe3b80538fe17e34adc04e89923426c9ab545aebb38891921304f72b");

    private LegacyMigrationChecksums() {
    }

    /** 已登记的原始历史 checksum；未登记返回 {@code null}。 */
    public static String legacyChecksum(String version) {
        return version == null ? null : LEGACY_CHECKSUMS.get(version);
    }

    /** 已固定的当前文件 checksum；未登记返回 {@code null}。 */
    public static String currentChecksum(String version) {
        return version == null ? null : CURRENT_CHECKSUMS.get(version);
    }

    /**
     * 判断是否为"同一历史迁移的等价实现"。
     *
     * <p>成立条件（必须同时满足）：
     * <ol>
     *   <li>{@code version} 已在映射中登记；</li>
     *   <li>{@code ledgerChecksum} 严格等于该 version 已登记的历史 checksum；</li>
     *   <li>{@code currentChecksum} 严格等于该 version 已固定的当前文件 checksum。</li>
     * </ol>
     *
     * @param version        迁移版本号（如 {@code "001"}）
     * @param currentChecksum 当前仓库文件实际计算出的 checksum
     * @param ledgerChecksum  数据库中 {@code schema_migration} 已记录的 checksum
     * @return 是否可视为同一历史迁移
     */
    public static boolean isEquivalent(String version, String currentChecksum, String ledgerChecksum) {
        if (version == null || currentChecksum == null || ledgerChecksum == null) {
            return false;
        }
        String expectedLegacy = LEGACY_CHECKSUMS.get(version);
        String expectedCurrent = CURRENT_CHECKSUMS.get(version);
        if (expectedLegacy == null || expectedCurrent == null) {
            return false;
        }
        return expectedLegacy.equals(ledgerChecksum) && expectedCurrent.equals(currentChecksum);
    }
}
