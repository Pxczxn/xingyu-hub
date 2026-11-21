package top.pxczxn.xingyu.community.support;

import top.pxczxn.xingyu.community.entity.SearchDocument;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 关注流跨类型截断：主序 indexed_at DESC，并列 object_id DESC。
 *
 * <p>按类型各取全局 Top-K 再归并，与「拉全量再截断」对同一排序键得到同一集合。
 */
public final class FollowedContentSupport {

    public static final int HOME_FOLLOW_LIMIT = 10;

    public static final Comparator<SearchDocument> BY_INDEXED_AT_THEN_ID =
            Comparator.comparing(SearchDocument::getIndexedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(SearchDocument::getObjectId, Comparator.nullsLast(Comparator.reverseOrder()));

    private FollowedContentSupport() {
    }

    public static List<SearchDocument> newestIndexed(List<SearchDocument> documents, int limit) {
        if (documents == null || documents.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<SearchDocument> copy = new ArrayList<>(documents);
        copy.sort(BY_INDEXED_AT_THEN_ID);
        if (copy.size() <= limit) {
            return List.copyOf(copy);
        }
        return List.copyOf(copy.subList(0, limit));
    }
}
