package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchIndexEntry;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Keeps the public search index in step with the content it describes.
 *
 * <p>This is the AUTHORITATIVE half of the pipeline: it is handed nothing but "object X
 * changed" and re-reads the source of truth to decide whether X belongs in the index. That
 * is what makes it safe to drive from retryable events (§20.3) — replaying an event
 * re-derives the same answer instead of applying the same delta twice.
 *
 * <p>It also means a caller cannot get the direction wrong. Nobody has to remember whether a
 * given event means "index this" or "unindex this"; the event only says *which object*, and
 * the state of that object decides.
 *
 * <p>Not every aggregate type is indexable. `search_document` is read by home, search, topics,
 * discovery, bookmark validation and event submissions, and §20.1 lists what it covers:
 * 文章 / 动态 / 用户 / 系列 / 话题 / 星系. Users, topics and galaxies are NOT projected here —
 * they already have their own tables and their own list endpoints — so an event about one of
 * them is a deliberate no-op rather than a bug.
 */
@Service
@RequiredArgsConstructor
public class SearchIndexService {

    public static final String ARTICLE = "ARTICLE";
    public static final String SERIES = "SERIES";
    public static final String MOMENT = "MOMENT";

    /** How much of a moment body becomes its index title — moments have no title column. */
    private static final int MOMENT_TITLE_MAX_LENGTH = 80;

    private final ArticleMapper articleMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final SearchIndexProvider indexProvider;

    /**
     * Re-derives whether the object belongs in the public index, and applies that.
     * Idempotent: calling it twice with the same state writes the same thing twice.
     */
    @Transactional
    public void refresh(String objectType, String objectId) {
        if (objectId == null || objectId.isBlank()) {
            return;
        }
        String type = objectType == null ? "" : objectType.trim().toUpperCase(Locale.ROOT);
        switch (type) {
            case ARTICLE -> refreshArticle(objectId);
            case SERIES -> refreshSeries(objectId);
            case MOMENT -> refreshMoment(objectId);
            default -> {
                // Not an indexed type. The event consumer hands EVERY event to EVERY handler,
                // so an unrecognised aggregate must fall through quietly, not fail the event.
            }
        }
    }

    private void refreshArticle(String articleId) {
        Article article = articleMapper.selectById(articleId);
        if (article == null || !isPublic(article)) {
            indexProvider.remove(ARTICLE, articleId);
            return;
        }

        // The PUBLIC title and summary come from the published revision, not from the working
        // draft — an article can be published while its next revision sits in review.
        PublishedRevision published = publishedRevisionMapper.findByArticleId(articleId);
        FormalRevision revision = published == null
                ? null
                : formalRevisionMapper.selectById(published.getFormalRevisionId());
        if (revision == null) {
            indexProvider.remove(ARTICLE, articleId);
            return;
        }

        indexProvider.upsert(SearchIndexEntry.builder()
                .objectType(ARTICLE)
                .objectId(articleId)
                .title(revision.getTitle())
                .summary(revision.getSummary())
                .build());
    }

    private void refreshSeries(String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            indexProvider.remove(SERIES, seriesId);
            return;
        }
        indexProvider.upsert(SearchIndexEntry.builder()
                .objectType(SERIES)
                .objectId(seriesId)
                .title(series.getTitle())
                .summary(series.getDescription())
                .build());
    }

    /**
     * Moments carry no title, so the index title is derived from the body's first line. That
     * is a projection choice rather than a stored fact: the feed renders a moment by its
     * body, and `search_document.title` is NOT NULL.
     */
    private void refreshMoment(String momentId) {
        Moment moment = momentMapper.selectById(momentId);
        if (moment == null || !"PUBLISHED".equals(moment.getStatus())) {
            indexProvider.remove(MOMENT, momentId);
            return;
        }
        MomentRevision revision = momentRevisionMapper.findLatestByMomentId(momentId);
        if (revision == null) {
            indexProvider.remove(MOMENT, momentId);
            return;
        }
        indexProvider.upsert(SearchIndexEntry.builder()
                .objectType(MOMENT)
                .objectId(momentId)
                .title(momentTitle(revision.getBody()))
                .summary(revision.getBody())
                .build());
    }

    /**
     * An article is publicly readable once it has been published and is neither trashed nor
     * under a moderation measure.
     *
     * <p>Deliberately NOT `article.status == PUBLISHED`. Submitting a new revision sets the
     * article back to IN_REVIEW while the PREVIOUS published revision stays readable
     * (`ReviewService.submit` overwrites `status`; `PublicationService` only replaces the
     * published revision once the new one is approved). Keying on `status` would drop live
     * content out of the index every time an author edits it. The published revision row is
     * the real signal — the same one `ContentCoverService` and the public article endpoint use.
     */
    private static boolean isPublic(Article article) {
        return ArticleStateSupport.isActiveLifecycle(article)
                && ArticleStateSupport.MODERATION_NORMAL.equals(
                        ArticleStateSupport.normalizeModeration(article.getModerationStatus()));
    }

    private static String momentTitle(String body) {
        if (body == null) {
            return null;
        }
        String firstLine = body.strip();
        int newline = firstLine.indexOf('\n');
        if (newline >= 0) {
            firstLine = firstLine.substring(0, newline).strip();
        }
        if (firstLine.isEmpty()) {
            return null;
        }
        return firstLine.length() <= MOMENT_TITLE_MAX_LENGTH
                ? firstLine
                : firstLine.substring(0, MOMENT_TITLE_MAX_LENGTH);
    }
}
