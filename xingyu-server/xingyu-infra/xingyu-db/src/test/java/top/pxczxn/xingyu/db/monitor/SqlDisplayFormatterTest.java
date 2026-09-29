package top.pxczxn.xingyu.db.monitor;

import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.ParameterMapping;
import org.apache.ibatis.mapping.ParameterMode;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.type.TypeHandlerRegistry;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class SqlDisplayFormatterTest {

    private final Configuration configuration = new Configuration();

    @Test
    void formatsStringNumberAndNull() {
        Map<String, Object> params = new HashMap<>();
        params.put("id", 1L);
        params.put("status", null);
        params.put("nickname", "星语");
        BoundSql boundSql = boundSql(
                "SELECT * FROM sys_user WHERE id = ? AND status = ? AND nickname = ?",
                List.of(
                        mapping("id"),
                        mapping("status"),
                        mapping("nickname")),
                params);

        String displaySql = SqlDisplayFormatter.format(mappedStatement(), boundSql);

        assertEquals(
                "SELECT * FROM sys_user WHERE id = 1 AND status = NULL AND nickname = '星语'",
                displaySql);
    }

    @Test
    void formatsTimestamp() {
        LocalDateTime time = LocalDateTime.of(2026, 8, 26, 13, 30, 15);
        BoundSql boundSql = boundSql(
                "UPDATE sys_user SET update_time = ? WHERE id = ?",
                List.of(mapping("updateTime"), mapping("id")),
                Map.of("updateTime", Timestamp.valueOf(time), "id", 9));

        String displaySql = SqlDisplayFormatter.format(mappedStatement(), boundSql);

        assertEquals(
                "UPDATE sys_user SET update_time = '2026-08-26 13:30:15' WHERE id = 9",
                displaySql);
    }

    @Test
    void masksSensitivePropertyAndColumn() {
        BoundSql propertyBoundSql = boundSql(
                "UPDATE community_account SET password = ? WHERE id = ?",
                List.of(mapping("password"), mapping("id")),
                Map.of("password", "plain-text", "id", 3));

        String propertyMasked = SqlDisplayFormatter.format(mappedStatement(), propertyBoundSql);
        assertEquals("UPDATE community_account SET password = '******' WHERE id = 3", propertyMasked);

        BoundSql columnBoundSql = boundSql(
                "UPDATE community_account SET access_token = ? WHERE id = ?",
                List.of(mapping("param1"), mapping("param2")),
                Map.of("param1", "jwt-token", "param2", 3));

        String columnMasked = SqlDisplayFormatter.format(mappedStatement(), columnBoundSql);
        assertEquals("UPDATE community_account SET access_token = '******' WHERE id = 3", columnMasked);
    }

    @Test
    void formatsInstant() {
        Instant now = LocalDateTime.of(2026, 8, 26, 14, 34, 49).atZone(ZoneId.systemDefault()).toInstant();
        BoundSql boundSql = boundSql(
                "SELECT * FROM reliable_event WHERE next_attempt_at <= ? AND lease_until < ? LIMIT ?",
                List.of(mapping("now"), mapping("now"), mapping("limit")),
                Map.of("now", now, "limit", 20));

        String displaySql = SqlDisplayFormatter.format(mappedStatement(), boundSql);

        assertEquals(
                "SELECT * FROM reliable_event WHERE next_attempt_at <= '2026-08-26 14:34:49' AND lease_until < '2026-08-26 14:34:49' LIMIT 20",
                displaySql);
    }

    @Test
    void escapesSingleQuoteInString() {
        BoundSql boundSql = boundSql(
                "SELECT * FROM sys_user WHERE nickname = ?",
                List.of(mapping("nickname")),
                Map.of("nickname", "O'Neil"));

        String displaySql = SqlDisplayFormatter.format(mappedStatement(), boundSql);

        assertTrue(displaySql.contains("'O''Neil'"));
    }

    private MappedStatement mappedStatement() {
        MappedStatement mappedStatement = Mockito.mock(MappedStatement.class);
        when(mappedStatement.getConfiguration()).thenReturn(configuration);
        return mappedStatement;
    }

    private ParameterMapping mapping(String property) {
        return new ParameterMapping.Builder(configuration, property, Object.class).build();
    }

    private BoundSql boundSql(String sql, List<ParameterMapping> mappings, Object parameterObject) {
        BoundSql boundSql = Mockito.mock(BoundSql.class);
        when(boundSql.getSql()).thenReturn(sql);
        when(boundSql.getParameterMappings()).thenReturn(mappings);
        when(boundSql.getParameterObject()).thenReturn(parameterObject);
        when(boundSql.hasAdditionalParameter(Mockito.anyString())).thenReturn(false);
        return boundSql;
    }
}
