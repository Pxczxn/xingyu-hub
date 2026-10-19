package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.SeriesChapterView;
import top.pxczxn.xingyu.community.dto.PublicIdentityView;
import top.pxczxn.xingyu.community.dto.PublicSeriesSummaryView;
import top.pxczxn.xingyu.community.dto.PublicSeriesView;
import top.pxczxn.xingyu.community.dto.SeriesSummaryView;
import top.pxczxn.xingyu.community.dto.SeriesView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.SeriesSubscriptionMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.CursorCodec;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SeriesService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9-]{2,64}$");
    private static final int MAX_TITLE_LENGTH = 256;
    private static final int MAX_DESCRIPTION_LENGTH = 1024;

    private final CreationSpaceService spaceService;
    private final SeriesMapper seriesMapper;
    private final SeriesSubscriptionMapper seriesSubscriptionMapper;
    private final SeriesChapterMapper chapterMapper;
    private final ArticleMapper articleMapper;
    private final CommunityProfileMapper profileMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CommunityEventSupport eventSupport;
    private final WorkingDraftMapper workingDraftMapper;

    public List<SeriesSummaryView> listForOwner(CommunityUser user) {
        return seriesMapper.listByOwnerId(user.getId()).stream()
                .map(this::toSummary)
                .toList();
    }

    public List<PublicSeriesSummaryView> listPublic(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<Series> series = seriesMapper.listActive(limit);
        if (series.isEmpty()) {
            return List.of();
        }
        Map<String, CommunityProfile> profiles = profileMapper.findByUserIds(
                        series.stream().map(Series::getOwnerId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(CommunityProfile::getUserId, Function.identity()));
        return series.stream()
                .filter(item -> profiles.containsKey(item.getOwnerId()))
                .map(item -> toPublicSummary(item, profiles.get(item.getOwnerId())))
                .toList();
    }

    /**
     * 公开系列目录：keyset 分页 + 全集合关键字搜索（2026-10-18）。
     *
     * <p>为什么不是在 {@link #listPublic(int)} 上加参数：那个方法的响应是一个裸数组，
     * 而分页必须回报"还有没有下一页"（{@code nextCursor}）和真实匹配总数。改响应形状
     * 会直接打断既有调用方，所以保留旧端点并在旁边提供这一条。
     *
     * <p>语义：
     * <ul>
     *   <li>{@code q} 为空 → 按最近更新浏览整个公开集合；非空 → 在<b>整个</b>公开集合里
     *       匹配标题 / 简介 / 作者用户名 / 作者显示名，而不是匹配某一页已经取到的数据；</li>
     *   <li>排序 {@code (updated_at DESC, id DESC)} 是全序，翻页不重不漏；</li>
     *   <li>{@code nextCursor == null} 是"没有下一页"的唯一证据；</li>
     *   <li>{@code total} 是当前过滤条件下的真实总数（COUNT），不是本页条数。</li>
     * </ul>
     *
     * <p>cursor 是透明的续读标记，不是权限边界；但它必须是本服务签发过的形状，
     * 伪造/别的域的 cursor 一律 400，避免静默回到第一页让读者重复浏览。
     */
    public PageResultView<PublicSeriesSummaryView> searchPublic(String query, int limit, String cursor) {
        int pageSize = limit <= 0 ? 20 : Math.min(limit, 50);
        String keyword = query == null || query.isBlank() ? null : escapeLikeLiteral(query.trim());

        Instant cursorUpdatedAt = null;
        String cursorId = null;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null || !"SERIES".equals(parts[0])) {
                throw new FieldContractException("cursor", "分页游标无效");
            }
            cursorUpdatedAt = Instant.ofEpochMilli(Long.parseLong(parts[1]));
            cursorId = parts[2];
        }

        /* 多取一条只用于探测"还有没有下一页"：items.size() == limit 无法区分
           "正好穷尽"与"还有更多"，旧实现因此会在整页倍数处提前收起加载入口。 */
        List<Series> rows = seriesMapper.searchPublic(keyword, cursorUpdatedAt, cursorId, pageSize + 1);
        boolean hasMore = rows.size() > pageSize;
        List<Series> page = hasMore ? rows.subList(0, pageSize) : rows;

        Map<String, CommunityProfile> profiles = page.isEmpty()
                ? Map.of()
                : profileMapper.findByUserIds(
                                page.stream().map(Series::getOwnerId).collect(Collectors.toSet()))
                        .stream()
                        .collect(Collectors.toMap(CommunityProfile::getUserId, Function.identity()));
        List<PublicSeriesSummaryView> items = page.stream()
                .filter(item -> profiles.containsKey(item.getOwnerId()))
                .map(item -> toPublicSummary(item, profiles.get(item.getOwnerId())))
                .toList();

        String nextCursor = hasMore
                ? CursorCodec.encode(
                        "SERIES",
                        page.get(page.size() - 1).getUpdatedAt(),
                        page.get(page.size() - 1).getId())
                : null;

        return PageResultView.<PublicSeriesSummaryView>builder()
                .items(items)
                .nextCursor(nextCursor)
                .total(seriesMapper.countPublic(keyword))
                .build();
    }

    @Transactional
    public SeriesView create(CommunityUser user, Map<String, Object> body) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        String title = requireTitle(body.get("title"));
        String slug = normalizeSlug(body.get("slug") == null ? title : body.get("slug"));
        validateSlug(slug);
        if (seriesMapper.findByOwnerIdAndSlug(user.getId(), slug) != null) {
            throw new FieldContractException("slug", "别名已被占用");
        }
        Instant now = Instant.now();
        Series series = new Series();
        series.setId(TokenSupport.newId());
        series.setOwnerId(user.getId());
        series.setSpaceId(space.getId());
        series.setTitle(title);
        series.setSlug(slug);
        series.setDescription(normalizeDescription(body.get("description")));
        series.setStatus("ACTIVE");
        series.setLockVersion(0L);
        series.setCreatedAt(now);
        series.setUpdatedAt(now);
        seriesMapper.insert(series);
        publishSeriesChanged(series);
        return toView(series, List.of());
    }

    public SeriesView getForOwner(CommunityUser user, String seriesId) {
        Series series = requireOwnedSeries(user, seriesId);
        return toView(series, chapterMapper.listBySeriesId(seriesId));
    }

    public PublicSeriesView getPublic(String username, String slug) {
        Series series = seriesMapper.findPublicByUsernameAndSlug(username, slug);
        if (series == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toPublicView(series, requirePublicProfile(series), chapterMapper.listBySeriesId(series.getId()));
    }

    public PublicSeriesView getPublicById(String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toPublicView(series, requirePublicProfile(series), chapterMapper.listBySeriesId(series.getId()));
    }

    /**
     * 更新系列（Series Optimistic Lock Recovery，2026-10-10 P0-B）。
     *
     * <p>旧实现是「先读后写」两步——内存比较 lockVersion 后 {@code updateById} 全字段
     * 更新（WHERE 只有 id）。这与 ArticleService.saveDraft 在 2026-10-09 修复的 D0 缺陷
     * 同型：REPEATABLE READ 下两个客户端基于同一版本并发保存会双双通过校验、后写静默
     * 覆盖前者，且两次都写 expected+1，版本号不变，事后无法察觉。现在检查-写入在同一
     * 条件 UPDATE 内原子完成（WHERE id + lock_version = expected，SET lock_version =
     * expected + 1），affected=0 即并发冲突 → 409，本次写库整体未发生。
     *
     * <p>影响行数为 0 的归因：不存在/非本人系列已在 {@link #requireOwnedSeries} 以 404
     * 拒绝；系列无删除端点，行不可能在此间消失——因此到达条件 UPDATE 后 affected=0
     * 只能是版本冲突。
     *
     * <p>与 D0/D3 同纪律：SET 子句只包含本次提交的键（显式 null = 清空 description），
     * 响应从 DB 重读构造，与持久化结果严格一致。
     */
    @Transactional
    public SeriesView update(CommunityUser user, String seriesId, Map<String, Object> body) {
        Series series = requireOwnedSeries(user, seriesId);
        /*
         * 乐观锁令牌是契约的必需字段。旧实现允许缺省并回退到"当前版本"，
         * 这让一个忘记带 lockVersion 的客户端永远成功——等于关掉了并发保护。
         * 拒绝缺省值而不是猜测，才能保证"读取版本 → 提交版本"这条链路真实存在。
         */
        if (!(body.get("lockVersion") instanceof Number lockVersionToken)) {
            throw new FieldContractException("lockVersion", "缺少版本号");
        }
        long expected;
        try {
            expected = new java.math.BigDecimal(lockVersionToken.toString()).longValueExact();
            if (expected < 0) {
                throw new ArithmeticException("negative version");
            }
        } catch (ArithmeticException | NumberFormatException invalidVersion) {
            throw new FieldContractException("lockVersion", "版本号必须是有效的非负整数");
        }
        long currentVersion = series.getLockVersion() == null ? 0L : series.getLockVersion();
        if (currentVersion != expected) {
            // 快速失败路径：真正的并发裁决在下面的条件 UPDATE
            throw new ContractException(ErrorCode.CONFLICT, "系列已被他人更新");
        }
        // 字段校验先行：任何契约错误都必须发生在写库之前
        String title = body.containsKey("title") ? requireTitle(body.get("title")) : null;
        String description = body.containsKey("description")
                ? normalizeDescription(body.get("description"))
                : null;
        String status = null;
        if (body.containsKey("status")) {
            status = String.valueOf(body.get("status")).trim().toUpperCase(Locale.ROOT);
            if (!"ACTIVE".equals(status) && !"ARCHIVED".equals(status)) {
                throw new FieldContractException("status", "状态值无效");
            }
        }
        /* 章节列表先完整校验、再写库：格式错误、重复 ID 或不属于本人的文章都必须在
           删除旧关联之前被拒绝，而不是依赖数据库唯一键或事务回滚兜底。 */
        List<String> chapterArticleIds = null;
        if (body.containsKey("chapterArticleIds")) {
            chapterArticleIds = parseChapterArticleIds(body.get("chapterArticleIds"));
            requireChapterArticlesOwned(series, chapterArticleIds);
        }

        Instant now = Instant.now();
        UpdateWrapper<Series> update = new UpdateWrapper<Series>()
                .eq("id", seriesId)
                .eq("lock_version", expected)
                .set("lock_version", expected + 1)
                .set("updated_at", now);
        if (body.containsKey("title")) {
            update.set("title", title);
        }
        if (body.containsKey("description")) {
            update.set("description", description);
        }
        if (status != null) {
            update.set("status", status);
        }
        int updated = seriesMapper.update(null, update);
        if (updated == 0) {
            // 并发期间版本已被其他请求推进：本次保存整体未生效
            throw new ContractException(ErrorCode.CONFLICT, "系列已被他人更新");
        }

        if (chapterArticleIds != null) {
            replaceChapters(series.getId(), chapterArticleIds);
        }

        Series fresh = seriesMapper.selectById(seriesId);
        publishSeriesChanged(fresh);
        return toView(fresh, chapterMapper.listBySeriesId(seriesId));
    }

    /**
     * Queues a series index refresh.
     *
     * <p>The event id includes the lock version, which is bumped on every update — so two
     * distinct edits produce two events, while a retried publish of the same version is
     * deduplicated by the outbox. Creation starts at version 0.
     */
    private void publishSeriesChanged(Series series) {
        long version = series.getLockVersion() == null ? 0L : series.getLockVersion();
        eventSupport.publishContentEvent(
                "series-changed:" + series.getId() + ":" + version,
                CommunityEventSupport.SERIES_CHANGED,
                CommunityEventSupport.AGGREGATE_TYPE_SERIES,
                series.getId());
    }

    /**
     * Parses the replacement list without touching the database.
     *
     * <p>旧实现先 {@code deleteBySeriesId} 再判断 {@code raw instanceof List}：
     * 一个 {@code chapterArticleIds: {}} 或字符串会把整份章节静默清空，并返回 200。
     * 现在非数组一律 400；重复 ID 也在写库前拒绝——DB 的
     * {@code uk_series_chapter_series_article} 虽然能挡住重复，但会以
     * DuplicateKeyException/500 的形式出现，创作者看不到可理解的错误。
     *
     * <p>空数组仍然合法，语义就是"清空章节"（保留系列本身）。
     */
    private List<String> parseChapterArticleIds(Object raw) {
        if (!(raw instanceof List<?> entries)) {
            throw new FieldContractException("chapterArticleIds", "章节列表必须是数组");
        }
        LinkedHashSet<String> articleIds = new LinkedHashSet<>();
        for (Object rawId : entries) {
            if (!(rawId instanceof String value) || value.isBlank()) {
                throw new FieldContractException("chapterArticleIds", "章节 ID 必须是非空字符串");
            }
            String articleId = value.trim();
            if (!articleIds.add(articleId)) {
                throw new FieldContractException("chapterArticleIds", "章节不能重复");
            }
        }
        return List.copyOf(articleIds);
    }

    /**
     * Ownership check for every chapter article, before any write.
     *
     * <p>One batch read instead of a SELECT per chapter: 50 chapters is a normal
     * series, and the replacement path is the hottest write on this page.
     */
    private void requireChapterArticlesOwned(Series series, List<String> articleIds) {
        if (articleIds.isEmpty()) {
            return;
        }
        Map<String, Article> found = articleMapper.selectBatchIds(articleIds).stream()
                .collect(Collectors.toMap(Article::getId, Function.identity()));
        for (String articleId : articleIds) {
            Article article = found.get(articleId);
            if (article == null || !series.getOwnerId().equals(article.getOwnerId())) {
                throw new FieldContractException("chapterArticleIds", "章节文章不存在或不属于当前用户");
            }
        }
    }

    /**
     * Full replacement of the chapter list. The caller has already validated the
     * ids; this only deletes the old rows and inserts the new order.
     *
     * <p>Chapter identity for readers is the article id, not {@code series_chapter.id}
     * — every save recreates the relation rows, so deep links and reading progress
     * (which both key on the article) survive a reorder.
     */
    private void replaceChapters(String seriesId, List<String> articleIds) {
        chapterMapper.deleteBySeriesId(seriesId);
        if (articleIds.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        int position = 1;
        for (String articleId : articleIds) {
            SeriesChapter chapter = new SeriesChapter();
            chapter.setId(TokenSupport.newId());
            chapter.setSeriesId(seriesId);
            chapter.setArticleId(articleId);
            chapter.setPosition(position++);
            chapter.setCreatedAt(now);
            chapterMapper.insert(chapter);
        }
    }

    private Series requireOwnedSeries(CommunityUser user, String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !user.getId().equals(series.getOwnerId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return series;
    }

    private SeriesSummaryView toSummary(Series series) {
        return SeriesSummaryView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .status(series.getStatus())
                .chapterCount((int) chapterMapper.countBySeriesId(series.getId()))
                .updatedAt(series.getUpdatedAt())
                .build();
    }

    private PublicSeriesSummaryView toPublicSummary(Series series, CommunityProfile profile) {
        return PublicSeriesSummaryView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .chapterCount((int) chapterMapper.countBySeriesId(series.getId()))
                .author(toPublicIdentity(profile))
                .build();
    }

    /**
     * 章节标题解析（Static Design Final Fix CB-2，2026-10-09）。
     *
     * <p>标题首选搜索索引文档（仅已发布/被索引文章存在），回退 working_draft.title。
     * {@code includeDraftTitle} 由调用方按视图域决定：
     * <ul>
     *   <li>owner 视图（{@code toView}）传 {@code true}——创作者在编排页必须能辨认
     *       自己的草稿章节（此前 document=null → title=null → 前端显示"无标题文章"+裸
     *       articleId，已实测）；</li>
     *   <li>公开视图（{@code toPublicView}）传 {@code false}——保持现状：草稿章节
     *       title 仍为 null，绝不向公开系列接口泄露私人草稿的标题信息。</li>
     * </ul>
     */
    private SeriesChapterView toChapterView(SeriesChapter chapter, boolean includeDraftTitle) {
        String title = null;
        var document = searchDocumentMapper.findByObject("ARTICLE", chapter.getArticleId());
        if (document != null) {
            title = document.getTitle();
        } else if (includeDraftTitle) {
            var draft = workingDraftMapper.findByArticleId(chapter.getArticleId());
            if (draft != null) {
                title = draft.getTitle();
            }
        }
        return SeriesChapterView.builder()
                .id(chapter.getId())
                .articleId(chapter.getArticleId())
                .title(title)
                .position(chapter.getPosition() == null ? 0 : chapter.getPosition())
                .build();
    }

    private SeriesView toView(Series series, List<SeriesChapter> chapters) {
        return SeriesView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .status(series.getStatus())
                .lockVersion(series.getLockVersion() == null ? 0L : series.getLockVersion())
                .chapters(chapters.stream().map(chapter -> toChapterView(chapter, true)).toList())
                .updatedAt(series.getUpdatedAt())
                .build();
    }

    private PublicSeriesView toPublicView(
            Series series, CommunityProfile profile, List<SeriesChapter> chapters) {
        // hasSubscribed 是 viewer-scoped 的：有登录用户时按订阅表回填 true/false，
        // 游客保持 null（「未知」≠「未订阅」）。/api/v1/series 的 GET 已注册为
        // 公开读拦截（CommunityAuthInterceptor），有 token 时上下文带身份。
        CommunityUser viewer = CommunityAuthContext.currentUser().orElse(null);
        Boolean hasSubscribed = viewer == null ? null
                : seriesSubscriptionMapper.findByUserAndSeries(viewer.getId(), series.getId()) != null;
        return PublicSeriesView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .chapters(chapters.stream().map(chapter -> toChapterView(chapter, false)).toList())
                .author(toPublicIdentity(profile))
                .hasSubscribed(hasSubscribed)
                .build();
    }

    private CommunityProfile requirePublicProfile(Series series) {
        CommunityProfile profile = profileMapper.findByUserId(series.getOwnerId());
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return profile;
    }

    private PublicIdentityView toPublicIdentity(CommunityProfile profile) {
        return PublicIdentityView.builder()
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .avatar(ProfileSettingsSupport.resolveAvatar(profile))
                .build();
    }

    private static String requireTitle(Object raw) {
        String title = raw == null ? "" : String.valueOf(raw).trim();
        if (title.isBlank()) {
            throw new FieldContractException("title", "标题不能为空");
        }
        if (title.codePointCount(0, title.length()) > MAX_TITLE_LENGTH) {
            throw new FieldContractException("title", "标题不能超过 256 个字符");
        }
        return title;
    }

    /**
     * Description is optional; explicit empty string clears it (same as the DB
     * column being nullable). The 1024 cap mirrors {@code series.description}
     * varchar(1024) so an over-long value is a 400 instead of a DB 500.
     */
    private static String normalizeDescription(Object raw) {
        String value = trimToNull(raw);
        if (value != null && value.codePointCount(0, value.length()) > MAX_DESCRIPTION_LENGTH) {
            throw new FieldContractException("description", "简介不能超过 1024 个字符");
        }
        return value;
    }

    private static void validateSlug(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new FieldContractException("slug", "别名格式无效");
        }
    }

    private static String normalizeSlug(Object raw) {
        return String.valueOf(raw).trim().toLowerCase(Locale.ROOT).replace(' ', '-');
    }

    /**
     * Escape LIKE metacharacters so a literal `%` / `_` in a search term is a character,
     * not a wildcard. Matches SearchService; the mapper uses {@code ESCAPE '!'}.
     */
    private static String escapeLikeLiteral(String query) {
        return query.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private static String trimToNull(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }
}
