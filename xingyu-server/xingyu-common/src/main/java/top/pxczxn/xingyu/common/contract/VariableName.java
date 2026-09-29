package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 可变名称（username / slug），与稳定 ObjectId 分离。
 */
public record VariableName(String value) {

    private static final Pattern PATTERN = Pattern.compile("^[a-z0-9_]{3,32}$");

    public VariableName {
        Objects.requireNonNull(value, "variableName");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("invalid variableName: " + value);
        }
        value = normalized;
    }

    @JsonCreator
    public static VariableName of(String raw) {
        return raw == null ? null : new VariableName(raw);
    }

    @JsonValue
    @Override
    public String value() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }
}
