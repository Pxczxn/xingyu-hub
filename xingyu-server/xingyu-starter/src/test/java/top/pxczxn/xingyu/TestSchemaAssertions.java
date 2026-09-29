package top.pxczxn.xingyu;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;

/**
 * 测试库结构前置断言（<b>只读</b>）。
 *
 * <p>本类只允许查询 {@code information_schema}，<b>禁止执行任何 DDL/DML</b>。
 * 它的唯一职责是：把"测试库结构是否与 migration baseline 一致"这件事变成一条硬断言，
 * 结构不对就让测试失败，而不是像过去那样由测试代码 {@code CREATE TABLE IF NOT EXISTS} /
 * {@code ALTER TABLE} 悄悄把表补上。
 *
 * <p>为什么必须这样：测试库由 {@code sql/V*.sql} 全量重建，是 schema 的唯一事实来源。
 * 一旦测试在结构缺失时自动兜底，就会出现"测试全绿但库结构已经偏离 baseline"的假绿——
 * 开发库的漂移正是这么来的（精简版建表抢先落地，后续迁移的 {@code CREATE TABLE IF NOT EXISTS}
 * 全部退化为空操作，索引与注释永久缺失，而台账还显示"已应用"）。
 *
 * <p>断言范围刻意覆盖"历史上真正漂移过的对象"，因此不满足于"表/列存在"：
 * <ul>
 *   <li>普通索引：索引名 + 唯一性 + <b>列顺序</b>；</li>
 *   <li>列：{@code COLUMN_TYPE} / {@code IS_NULLABLE} / {@code COLUMN_DEFAULT}；</li>
 *   <li>migration 明确定义的列注释与表注释（注释缺失正是精简版建表的指纹）；</li>
 *   <li>表级字符集排序规则。</li>
 * </ul>
 *
 * <p>断言会<b>先收集全部问题再一次性抛出</b>，避免"修一个跑一次"的疲劳。
 */
final class TestSchemaAssertions {

    /** 断言失败时的统一处置指引：必须改环境或改迁移，绝不允许改测试去迁就现状。 */
    private static final String REMEDIATION = """

            [schema baseline] 测试库结构与 migration baseline 不一致。

            测试库结构只能由 sql/V*.sql 全量重建得到；测试不会、也不允许自动修表。
            处置方式（任选其一，不要通过放宽断言或重新引入测试侧 DDL 来"解决"）：
              1. 重建测试库：bash sql/rebuild-test-db.sh
              2. 若确认 baseline 正确而本地库陈旧，同样执行上面的重建；
              3. 若确属 migration 定义有问题，请修改 sql/V*.sql 并重建，而不是用测试代码兜底。
            """;

    private final JdbcTemplate jdbcTemplate;
    private final List<String> problems = new ArrayList<>();

    private TestSchemaAssertions(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    static TestSchemaAssertions of(JdbcTemplate jdbcTemplate) {
        return new TestSchemaAssertions(jdbcTemplate);
    }

    /**
     * 断言所有"曾因测试侧自愈 DDL 而漂移过"的对象与 migration baseline 一致。
     *
     * <p>包含：V031 的 {@code featured_content} / {@code community_api_token}，
     * V033 的 {@code user_block} / {@code series_subscription} / {@code report_supplement} /
     * {@code galaxy_join_request}，V035 的 {@code event_registration}，
     * V001 基线的 {@code sys_file_config}，以及 V033 / V034 / V040 追加的 4 个列。
     */
    void assertDriftProneBaseline() {
        featuredContent();
        communityApiToken();
        userBlock();
        seriesSubscription();
        reportSupplement();
        galaxyJoinRequest();
        eventRegistration();
        sysFileConfig();
        appendedColumns();
        throwIfAny();
    }

    // ------------------------------------------------------------------
    // V031：运营精选内容 / 社区开放 API Token
    // ------------------------------------------------------------------

    private void featuredContent() {
        table("featured_content", "运营精选内容");
        column("featured_content", "id", "varchar(36)", false, null, "精选标识");
        column("featured_content", "object_type", "varchar(32)", false, null, "对象类型：ARTICLE/SERIES");
        column("featured_content", "object_id", "varchar(36)", false, null, "对象标识");
        column("featured_content", "sort_order", "int", false, "0", "排序（越小越靠前）");
        column("featured_content", "status", "varchar(32)", false, "ACTIVE", "状态：ACTIVE/ARCHIVED");
        column("featured_content", "created_at", "timestamp", false, null, "创建时间（UTC）");
        index("featured_content", "PRIMARY", true, "id");
        index("featured_content", "uk_featured_content_object", true, "object_type", "object_id");
        index("featured_content", "idx_featured_content_status", false,
                "status", "sort_order", "created_at");
    }

    private void communityApiToken() {
        table("community_api_token", "社区开放 API Token");
        column("community_api_token", "id", "varchar(36)", false, null, "Token 记录标识");
        column("community_api_token", "user_id", "varchar(36)", false, null, "所属用户");
        column("community_api_token", "name", "varchar(128)", false, null, "Token 名称");
        column("community_api_token", "token_prefix", "varchar(16)", false, null, "Token 前缀（展示用）");
        column("community_api_token", "token_hash", "varchar(64)", false, null, "Token SHA-256 哈希");
        column("community_api_token", "scopes", "varchar(256)", false, null, "权限域，逗号分隔");
        column("community_api_token", "status", "varchar(32)", false, "ACTIVE", "状态：ACTIVE/REVOKED");
        column("community_api_token", "last_used_at", "timestamp", true, null, "最近使用时间（UTC）");
        column("community_api_token", "created_at", "timestamp", false, null, "创建时间（UTC）");
        column("community_api_token", "revoked_at", "timestamp", true, null, "撤销时间（UTC）");
        index("community_api_token", "PRIMARY", true, "id");
        index("community_api_token", "uk_community_api_token_hash", true, "token_hash");
        index("community_api_token", "idx_community_api_token_user", false,
                "user_id", "status", "created_at");
    }

    // ------------------------------------------------------------------
    // V033：用户屏蔽 / 系列订阅 / 举报补充 / 星系入群申请
    // ------------------------------------------------------------------

    private void userBlock() {
        table("user_block", "社区用户屏蔽");
        column("user_block", "id", "varchar(36)", false, null, "屏蔽记录标识");
        column("user_block", "blocker_id", "varchar(36)", false, null, "屏蔽发起用户");
        column("user_block", "blocked_id", "varchar(36)", false, null, "被屏蔽用户");
        column("user_block", "created_at", "timestamp", false, null, "创建时间（UTC）");
        index("user_block", "PRIMARY", true, "id");
        index("user_block", "uk_user_block", true, "blocker_id", "blocked_id");
        index("user_block", "idx_user_block_blocked", false, "blocked_id");
    }

    private void seriesSubscription() {
        table("series_subscription", "系列追更订阅");
        column("series_subscription", "id", "varchar(36)", false, null, "订阅标识");
        column("series_subscription", "user_id", "varchar(36)", false, null, "用户标识");
        column("series_subscription", "series_id", "varchar(36)", false, null, "系列标识");
        column("series_subscription", "created_at", "timestamp", false, null, "订阅时间（UTC）");
        index("series_subscription", "PRIMARY", true, "id");
        index("series_subscription", "uk_series_subscription", true, "user_id", "series_id");
        index("series_subscription", "idx_series_subscription_series", false, "series_id");
    }

    private void reportSupplement() {
        table("report_supplement", "举报补充材料");
        column("report_supplement", "id", "varchar(36)", false, null, "补充材料标识");
        column("report_supplement", "report_id", "varchar(36)", false, null, "举报标识");
        column("report_supplement", "author_id", "varchar(36)", false, null, "提交用户");
        column("report_supplement", "body", "text", false, null, "补充说明");
        column("report_supplement", "created_at", "timestamp", false, null, "提交时间（UTC）");
        index("report_supplement", "PRIMARY", true, "id");
        index("report_supplement", "idx_report_supplement_report", false, "report_id", "created_at");
    }

    private void galaxyJoinRequest() {
        table("galaxy_join_request", "星系入群申请");
        column("galaxy_join_request", "id", "varchar(36)", false, null, "申请标识");
        column("galaxy_join_request", "galaxy_id", "varchar(36)", false, null, "星系标识");
        column("galaxy_join_request", "user_id", "varchar(36)", false, null, "申请用户");
        column("galaxy_join_request", "message", "varchar(512)", true, null, "申请说明");
        column("galaxy_join_request", "status", "varchar(32)", false, "PENDING",
                "状态：PENDING/APPROVED/REJECTED");
        column("galaxy_join_request", "created_at", "timestamp", false, null, "申请时间（UTC）");
        column("galaxy_join_request", "resolved_at", "timestamp", true, null, "处理时间（UTC）");
        index("galaxy_join_request", "PRIMARY", true, "id");
        // 唯一性约束，不只是性能索引：缺失会允许同一用户对同一星系重复提交待审申请。
        index("galaxy_join_request", "uk_galaxy_join_request_pending", true,
                "galaxy_id", "user_id", "status");
        index("galaxy_join_request", "idx_galaxy_join_request_galaxy", false,
                "galaxy_id", "status", "created_at");
    }

    // ------------------------------------------------------------------
    // V035：活动报名
    // ------------------------------------------------------------------

    private void eventRegistration() {
        table("event_registration", "活动报名");
        column("event_registration", "id", "varchar(36)", false, null, "报名标识");
        column("event_registration", "event_id", "varchar(36)", false, null, "活动标识");
        column("event_registration", "user_id", "varchar(36)", false, null, "用户标识");
        column("event_registration", "status", "varchar(32)", false, "REGISTERED",
                "状态：REGISTERED/CANCELLED");
        column("event_registration", "created_at", "timestamp", false, null, "报名时间（UTC）");
        column("event_registration", "cancelled_at", "timestamp", true, null, "取消时间（UTC）");
        index("event_registration", "PRIMARY", true, "id");
        index("event_registration", "uk_event_registration", true, "event_id", "user_id");
        index("event_registration", "idx_event_registration_user", false, "user_id", "created_at");
    }

    // ------------------------------------------------------------------
    // 管理端文件存储配置
    // ------------------------------------------------------------------

    /**
     * {@code sys_file_config} 的实际基线来自 {@code V001__mars_base_schema_and_seed.sql}。
     *
     * <p>注意：{@code V032__sys_file_config.sql} 用的是 {@code CREATE TABLE IF NOT EXISTS}，
     * 而 V001 早已建过同名表，因此在全新重建中 V032 的建表与种子始终是空操作——
     * 断言必须对齐"真正生效的那份定义"（V001），而不是 V032 里写的那份。
     */
    private void sysFileConfig() {
        table("sys_file_config", "文件存储配置表");
        columnWithExtra("sys_file_config", "id", "bigint", false, null, "配置ID", "auto_increment");
        column("sys_file_config", "name", "varchar(100)", false, null, "配置名称");
        column("sys_file_config", "storage_type", "varchar(20)", false, null, "存储类型(local/minio/aliyun)");
        column("sys_file_config", "master", "tinyint", true, "0", "是否为主配置(0否 1是)");
        column("sys_file_config", "domain", "varchar(255)", true, null, "访问域名");
        column("sys_file_config", "base_path", "varchar(255)", true, null, "基础路径(本地存储)");
        column("sys_file_config", "bucket_name", "varchar(100)", true, null, "存储桶名称");
        column("sys_file_config", "access_key", "varchar(255)", true, null, "访问密钥");
        column("sys_file_config", "secret_key", "varchar(255)", true, null, "秘密密钥");
        column("sys_file_config", "endpoint", "varchar(255)", true, null, "端点地址");
        column("sys_file_config", "region", "varchar(50)", true, null, "地域");
        column("sys_file_config", "status", "tinyint", true, "1", "状态(0禁用 1启用)");
        column("sys_file_config", "remark", "varchar(500)", true, null, "备注");
        column("sys_file_config", "create_by", "varchar(50)", true, null, "创建者");
        column("sys_file_config", "create_time", "datetime", true, "CURRENT_TIMESTAMP", "创建时间");
        column("sys_file_config", "update_by", "varchar(50)", true, null, "更新者");
        column("sys_file_config", "update_time", "datetime", true, "CURRENT_TIMESTAMP", "更新时间");
        index("sys_file_config", "PRIMARY", true, "id");
        index("sys_file_config", "idx_storage_type", false, "storage_type");
        index("sys_file_config", "idx_master", false, "master");
    }

    // ------------------------------------------------------------------
    // 后续迁移追加的列
    // ------------------------------------------------------------------

    private void appendedColumns() {
        column("galaxy", "join_mode", "varchar(32)", false, "OPEN", "入群模式：OPEN/APPROVAL");
        column("chat_message", "recalled_at", "timestamp", true, null, "撤回时间（UTC）");
        column("working_draft", "cover_url", "varchar(1024)", true, null, "封面图 URL");
        column("formal_revision", "cover_url", "varchar(1024)", true, null, "封面图 URL");
    }

    // ------------------------------------------------------------------
    // 断言原语：全部只读 information_schema
    // ------------------------------------------------------------------

    /**
     * 断言表存在、表注释与字符集排序规则符合基线。
     */
    TestSchemaAssertions table(String tableName, String comment) {
        List<String[]> rows = jdbcTemplate.query("""
                        SELECT TABLE_COLLATION, TABLE_COMMENT
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'
                        """,
                (rs, rowNum) -> new String[]{
                        rs.getString("TABLE_COLLATION"), rs.getString("TABLE_COMMENT")},
                tableName);
        if (rows.isEmpty()) {
            problems.add("缺少表 " + tableName + "（baseline 应存在该表）");
            return this;
        }
        String[] actual = rows.get(0);
        if (!"utf8mb4_0900_ai_ci".equals(actual[0])) {
            problems.add("表 " + tableName + " 的排序规则为 " + actual[0] + "，baseline 为 utf8mb4_0900_ai_ci");
        }
        if (!comment.equals(actual[1])) {
            problems.add("表 " + tableName + " 的注释为 [" + actual[1] + "]，baseline 为 [" + comment
                    + "]（注释缺失通常是测试侧精简建表抢先落地的指纹）");
        }
        return this;
    }

    /**
     * 断言列的类型 / 可空性 / 默认值 / 注释符合基线。
     *
     * @param expectedDefault 期望的默认值；{@code null} 表示该列不应有默认值
     */
    TestSchemaAssertions column(
            String tableName,
            String columnName,
            String type,
            boolean nullable,
            String expectedDefault,
            String comment) {
        return columnWithExtra(tableName, columnName, type, nullable, expectedDefault, comment, null);
    }

    /**
     * 同 {@link #column}，额外要求 {@code EXTRA} 包含指定片段（如 {@code auto_increment}）。
     *
     * @param extraContains 期望 {@code EXTRA} 包含的片段；{@code null} 表示不做该检查
     */
    TestSchemaAssertions columnWithExtra(
            String tableName,
            String columnName,
            String type,
            boolean nullable,
            String expectedDefault,
            String comment,
            String extraContains) {
        List<String[]> rows = jdbcTemplate.query("""
                        SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
                               IFNULL(EXTRA, '') AS EXTRA_TEXT, IFNULL(COLUMN_COMMENT, '') AS COMMENT_TEXT
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
                        """,
                (rs, rowNum) -> new String[]{
                        rs.getString("COLUMN_TYPE"),
                        rs.getString("IS_NULLABLE"),
                        // COLUMN_DEFAULT 为 SQL NULL 时取到 Java null，正好表示"无默认值"
                        rs.getString("COLUMN_DEFAULT"),
                        rs.getString("EXTRA_TEXT"),
                        rs.getString("COMMENT_TEXT")},
                tableName,
                columnName);
        if (rows.isEmpty()) {
            problems.add("表 " + tableName + " 缺少列 " + columnName + "（baseline 应存在该列）");
            return this;
        }
        String[] actual = rows.get(0);
        String where = tableName + "." + columnName;
        if (!type.equals(actual[0])) {
            problems.add(where + " 类型为 " + actual[0] + "，baseline 为 " + type);
        }
        String expectedNullable = nullable ? "YES" : "NO";
        if (!expectedNullable.equals(actual[1])) {
            problems.add(where + " 可空性为 " + actual[1] + "，baseline 为 " + expectedNullable);
        }
        if (expectedDefault == null ? actual[2] != null : !expectedDefault.equals(actual[2])) {
            problems.add(where + " 默认值为 " + describe(actual[2]) + "，baseline 为 " + describe(expectedDefault));
        }
        if (!comment.equals(actual[4])) {
            problems.add(where + " 注释为 [" + actual[4] + "]，baseline 为 [" + comment + "]");
        }
        if (extraContains != null && !actual[3].contains(extraContains)) {
            problems.add(where + " 的 EXTRA 为 [" + actual[3] + "]，应包含 " + extraContains);
        }
        return this;
    }

    /**
     * 断言索引存在、唯一性正确、且<b>列顺序</b>完全一致。
     */
    TestSchemaAssertions index(String tableName, String indexName, boolean unique, String... columns) {
        List<String[]> rows = jdbcTemplate.query("""
                        SELECT NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
                        FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
                        ORDER BY SEQ_IN_INDEX
                        """,
                (rs, rowNum) -> new String[]{
                        rs.getString("NON_UNIQUE"), rs.getString("COLUMN_NAME")},
                tableName,
                indexName);
        String where = tableName + " 的索引 " + indexName;
        if (rows.isEmpty()) {
            problems.add("缺少 " + where + "（baseline 应存在该索引；缺失会同时影响唯一性保证与查询性能）");
            return this;
        }
        boolean actualUnique = "0".equals(rows.get(0)[0]);
        if (actualUnique != unique) {
            problems.add(where + " 唯一性为 " + (actualUnique ? "UNIQUE" : "NON-UNIQUE")
                    + "，baseline 为 " + (unique ? "UNIQUE" : "NON-UNIQUE"));
        }
        List<String> actualColumns = new ArrayList<>();
        for (String[] row : rows) {
            actualColumns.add(row[1]);
        }
        List<String> expectedColumns = List.of(columns);
        if (!expectedColumns.equals(actualColumns)) {
            problems.add(where + " 的列为 " + actualColumns + "，baseline 为 " + expectedColumns);
        }
        return this;
    }

    private String describe(String value) {
        return value == null ? "<无默认值>" : "[" + value + "]";
    }

    private void throwIfAny() {
        if (problems.isEmpty()) {
            return;
        }
        StringBuilder message = new StringBuilder();
        message.append("[schema baseline] 测试库结构与 migration baseline 不一致，共 ")
                .append(problems.size())
                .append(" 处：\n");
        for (String problem : problems) {
            message.append("  - ").append(problem).append('\n');
        }
        message.append(REMEDIATION);
        problems.clear();
        throw new IllegalStateException(message.toString());
    }
}
