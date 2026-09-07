package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Objects;

/**
 * UTC 时间点，序列化为 ISO-8601 instant（带 Z）。
 */
public record InstantUtc(Instant instant) {

    public InstantUtc {
        Objects.requireNonNull(instant, "instant");
    }

    @JsonCreator
    public static InstantUtc parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new InstantUtc(Instant.parse(raw));
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("invalid instant: " + raw, ex);
        }
    }

    public static InstantUtc now() {
        return new InstantUtc(Instant.now());
    }

    @JsonValue
    public String asIsoString() {
        return instant.toString();
    }

    @Override
    public String toString() {
        return asIsoString();
    }
}
