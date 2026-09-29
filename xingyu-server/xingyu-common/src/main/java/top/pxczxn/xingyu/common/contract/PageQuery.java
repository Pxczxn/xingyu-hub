package top.pxczxn.xingyu.common.contract;

import lombok.Builder;
import lombok.Value;

/**
 * 游标分页：以稳定 ObjectId 作为 tie-breaker。
 */
@Value
@Builder
public class PageQuery {

    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    int limit;
    ObjectId cursor;

    public static PageQuery firstPage() {
        return PageQuery.builder().limit(DEFAULT_LIMIT).build();
    }

    public static PageQuery of(Integer limit, String cursorId) {
        int resolved = limit == null ? DEFAULT_LIMIT : limit;
        if (resolved < 1 || resolved > MAX_LIMIT) {
            throw new IllegalArgumentException("limit must be between 1 and " + MAX_LIMIT);
        }
        ObjectId cursor = cursorId == null || cursorId.isBlank() ? null : ObjectId.of(cursorId);
        return PageQuery.builder().limit(resolved).cursor(cursor).build();
    }
}
