package top.pxczxn.xingyu.db.monitor;

import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.ParameterMapping;
import org.apache.ibatis.mapping.ParameterMode;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.type.TypeHandlerRegistry;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 将 BoundSql 渲染为可读 SQL，仅用于日志展示，不参与真实执行。
 */
final class SqlDisplayFormatter {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final String MASKED_LITERAL = "'******'";

    private static final Pattern SENSITIVE_PROPERTY = Pattern.compile(
            ".*(password|passwd|pwd|secret|token|credential|api[_-]?key|access[_-]?key|private[_-]?key|authorization).*",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern SENSITIVE_COLUMN = Pattern.compile(
            "(password|passwd|pwd|secret|token|credential|api[_-]?key|access[_-]?key|private[_-]?key|authorization)\\s*=\\s*$",
            Pattern.CASE_INSENSITIVE);

    private SqlDisplayFormatter() {
    }

    static String format(MappedStatement mappedStatement, BoundSql boundSql) {
        if (boundSql == null) {
            return "N/A";
        }

        try {
            return formatInternal(mappedStatement, boundSql);
        } catch (Exception ignored) {
            return SqlMonitorSupport.normalizeSql(boundSql.getSql());
        }
    }

    private static String formatInternal(MappedStatement mappedStatement, BoundSql boundSql) {
        String sql = SqlMonitorSupport.normalizeSql(boundSql.getSql());
        var parameterMappings = boundSql.getParameterMappings();
        if (parameterMappings == null || parameterMappings.isEmpty()) {
            return sql;
        }

        Configuration configuration = mappedStatement.getConfiguration();
        Object parameterObject = boundSql.getParameterObject();
        TypeHandlerRegistry typeHandlerRegistry = configuration.getTypeHandlerRegistry();
        MetaObject metaObject = parameterObject == null ? null : configuration.newMetaObject(parameterObject);

        String displaySql = sql;
        for (ParameterMapping parameterMapping : parameterMappings) {
            if (parameterMapping.getMode() == ParameterMode.OUT) {
                continue;
            }

            Object value = resolveParameterValue(
                    boundSql,
                    parameterObject,
                    parameterMapping,
                    typeHandlerRegistry,
                    metaObject);
            int placeholderIndex = displaySql.indexOf('?');
            if (placeholderIndex < 0) {
                break;
            }

            String sqlBeforePlaceholder = displaySql.substring(0, placeholderIndex);
            boolean mask = shouldMask(parameterMapping.getProperty(), sqlBeforePlaceholder);
            String replacement = formatValue(value, mask);
            displaySql = displaySql.substring(0, placeholderIndex)
                    + replacement
                    + displaySql.substring(placeholderIndex + 1);
        }

        return displaySql;
    }

    private static Object resolveParameterValue(
            BoundSql boundSql,
            Object parameterObject,
            ParameterMapping parameterMapping,
            TypeHandlerRegistry typeHandlerRegistry,
            MetaObject metaObject) {
        String propertyName = parameterMapping.getProperty();
        if (boundSql.hasAdditionalParameter(propertyName)) {
            return boundSql.getAdditionalParameter(propertyName);
        }
        if (parameterObject == null) {
            return null;
        }
        if (typeHandlerRegistry.hasTypeHandler(parameterObject.getClass())) {
            return parameterObject;
        }
        if (metaObject == null) {
            return null;
        }
        return metaObject.getValue(propertyName);
    }

    private static boolean shouldMask(String propertyName, String sqlBeforePlaceholder) {
        if (propertyName != null && SENSITIVE_PROPERTY.matcher(propertyName).matches()) {
            return true;
        }
        return SENSITIVE_COLUMN.matcher(sqlBeforePlaceholder).find();
    }

    private static String formatValue(Object value, boolean mask) {
        if (mask) {
            return MASKED_LITERAL;
        }
        if (value == null) {
            return "NULL";
        }
        if (value instanceof String stringValue) {
            return quote(stringValue);
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof Timestamp timestamp) {
            return quote(timestamp.toLocalDateTime().format(DATE_TIME_FORMATTER));
        }
        if (value instanceof java.util.Date date) {
            return quote(new Timestamp(date.getTime()).toLocalDateTime().format(DATE_TIME_FORMATTER));
        }
        if (value instanceof Date date) {
            return quote(date.toLocalDate().format(DATE_FORMATTER));
        }
        if (value instanceof Time time) {
            return quote(time.toLocalTime().format(TIME_FORMATTER));
        }
        if (value instanceof LocalDateTime localDateTime) {
            return quote(localDateTime.format(DATE_TIME_FORMATTER));
        }
        if (value instanceof LocalDate localDate) {
            return quote(localDate.format(DATE_FORMATTER));
        }
        if (value instanceof LocalTime localTime) {
            return quote(localTime.format(TIME_FORMATTER));
        }
        if (value instanceof Instant instant) {
            return quote(LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(DATE_TIME_FORMATTER));
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return quote(offsetDateTime.format(DATE_TIME_FORMATTER));
        }
        if (value instanceof ZonedDateTime zonedDateTime) {
            return quote(zonedDateTime.format(DATE_TIME_FORMATTER));
        }
        if (value instanceof byte[]) {
            return "'[BINARY]'";
        }
        if (value instanceof Collection<?> collection) {
            String items = collection.stream()
                    .map(item -> formatValue(item, false))
                    .collect(Collectors.joining(", "));
            return "(" + items + ")";
        }
        if (value.getClass().isEnum()) {
            return quote(((Enum<?>) value).name());
        }
        return quote(String.valueOf(value));
    }

    private static String quote(String value) {
        return "'" + escapeSqlString(value) + "'";
    }

    private static String escapeSqlString(String value) {
        return value.replace("\\", "\\\\").replace("'", "''");
    }
}
