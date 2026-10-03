package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchIndexEntry;

/**
 * The index boundary required by the product doc §20.2:
 * 「建议通过 SearchIndexProvider / 领域接口隔离索引实现」.
 *
 * <p>Everything above this interface talks in terms of "this object should be indexed with
 * this title and summary" — never in terms of a table. That is what lets the DB-backed
 * projection be swapped for a real search engine later without touching the publish paths.
 *
 * <p>Both operations are IDEMPOTENT and must stay that way: they are driven by retryable
 * events (§20.3), so the same call will arrive more than once.
 *
 * <p>Neither operation may throw for "there is nothing to do" — removing an object that was
 * never indexed is a no-op, not an error.
 */
public interface SearchIndexProvider {

    /** Inserts or refreshes the row, and clears any previous removal. */
    void upsert(SearchIndexEntry entry);

    /** Marks the object as no longer public. Never deletes the row (a re-publish restores it). */
    void remove(String objectType, String objectId);
}
