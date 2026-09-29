package top.pxczxn.xingyu.db.monitor;

final class SqlMonitorSupport {

    private SqlMonitorSupport() {
    }

    static String resolveSqlType(String sql) {
        if (sql == null || sql.isBlank()) {
            return "UNKNOWN";
        }
        String upperSql = sql.trim().toUpperCase();
        if (upperSql.startsWith("SELECT")) {
            return "SELECT";
        }
        if (upperSql.startsWith("INSERT")) {
            return "INSERT";
        }
        if (upperSql.startsWith("UPDATE")) {
            return "UPDATE";
        }
        if (upperSql.startsWith("DELETE")) {
            return "DELETE";
        }
        if (upperSql.startsWith("CREATE")) {
            return "CREATE";
        }
        if (upperSql.startsWith("DROP")) {
            return "DROP";
        }
        if (upperSql.startsWith("ALTER")) {
            return "ALTER";
        }
        return "OTHER";
    }

    static String extractTableName(String sql) {
        if (sql == null || sql.isBlank()) {
            return "unknown";
        }
        try {
            String[] words = sql.trim().toUpperCase().split("\\s+");
            for (int i = 0; i < words.length - 1; i++) {
                if ("FROM".equals(words[i]) || "INTO".equals(words[i]) || "UPDATE".equals(words[i])) {
                    return words[i + 1].replaceAll("[^a-zA-Z0-9_]", "");
                }
            }
        } catch (Exception ignored) {
        }
        return "unknown";
    }

    static String normalizeSql(String sql) {
        if (sql == null || sql.isBlank()) {
            return "N/A";
        }
        return sql.replaceAll("\\s+", " ").trim();
    }

    static String colorizeSql(String sql, String sqlType) {
        String cleanSql = normalizeSql(sql);
        String typeColor = switch (sqlType) {
            case "SELECT" -> "\u001B[94m";
            case "INSERT" -> "\u001B[92m";
            case "UPDATE" -> "\u001B[93m";
            case "DELETE" -> "\u001B[91m";
            default -> "\u001B[95m";
        };

        String coloredSql = cleanSql
                .replaceAll("(?i)\\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT)\\b",
                        "\u001B[96m$1\u001B[0m" + typeColor)
                .replaceAll("(?i)\\b(INSERT|INTO|VALUES)\\b",
                        "\u001B[96m$1\u001B[0m" + typeColor)
                .replaceAll("(?i)\\b(UPDATE|SET)\\b",
                        "\u001B[96m$1\u001B[0m" + typeColor)
                .replaceAll("(?i)\\b(DELETE)\\b",
                        "\u001B[96m$1\u001B[0m" + typeColor)
                .replaceAll("(?i)\\b(AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL)\\b",
                        "\u001B[97m$1\u001B[0m" + typeColor)
                .replaceAll("(?i)\\b(COUNT|SUM|AVG|MAX|MIN|DISTINCT)\\b",
                        "\u001B[35m$1\u001B[0m" + typeColor)
                .replaceAll("'([^']*)'", "\u001B[32m'$1'\u001B[0m" + typeColor)
                .replaceAll("\\b(\\d+)\\b", "\u001B[33m$1\u001B[0m" + typeColor);

        return typeColor + coloredSql + "\u001B[0m";
    }

    static SqlMonitorLevel resolveLevel(long elapsedMs, SqlMonitorProperties properties) {
        if (elapsedMs >= properties.getSlowThresholdMs()) {
            return SqlMonitorLevel.SLOW;
        }
        if (elapsedMs >= properties.getWarnThresholdMs()) {
            return SqlMonitorLevel.WARN;
        }
        return SqlMonitorLevel.NORMAL;
    }
}
