package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * 稳定对象标识（UUID 字符串）。
 */
public record ObjectId(String value) {

    public ObjectId {
        Objects.requireNonNull(value, "objectId");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        try {
            UUID.fromString(normalized);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("invalid objectId: " + value, ex);
        }
        value = normalized;
    }

    @JsonCreator
    public static ObjectId of(String raw) {
        return raw == null ? null : new ObjectId(raw);
    }

    public static ObjectId random() {
        return new ObjectId(UUID.randomUUID().toString());
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
