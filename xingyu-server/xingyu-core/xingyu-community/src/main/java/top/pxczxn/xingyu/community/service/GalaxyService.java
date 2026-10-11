package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.GalaxyContentView;
import top.pxczxn.xingyu.community.dto.GalaxyJoinRequestView;
import top.pxczxn.xingyu.community.dto.GalaxyView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Galaxy;
import top.pxczxn.xingyu.community.entity.GalaxyContent;
import top.pxczxn.xingyu.community.entity.GalaxyMember;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.entity.GalaxyJoinRequest;
import top.pxczxn.xingyu.community.mapper.GalaxyJoinRequestMapper;
import top.pxczxn.xingyu.community.dto.GalaxyMemberView;
import top.pxczxn.xingyu.community.mapper.GalaxyContentMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMemberMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GalaxyService {

    private final GalaxyMapper galaxyMapper;
    private final GalaxyJoinRequestMapper joinRequestMapper;
    private final GalaxyMemberMapper memberMapper;
    private final GalaxyContentMapper contentMapper;
    private final CommunityProfileMapper profileMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final ContentCoverService contentCoverService;
    private final HomeFeedEnrichmentService enrichmentService;

    public List<GalaxyView> list() {
        return galaxyMapper.listAll().stream().map(this::toView).toList();
    }

    /**
     * 星系详情：在公共视图之上填充 viewer 私有状态与详情专属聚合。
     * joined 每请求现查 {@code galaxy_member}（三态：游客 null）——
     * 严禁放入任何跨请求缓存；contentCount 为挂载内容计数。
     */
    public GalaxyView getBySlug(String slug) {
        Galaxy galaxy = requireGalaxy(slug);
        CommunityUser viewer = CommunityAuthContext.currentUser().orElse(null);
        Boolean joined = viewer == null
                ? null
                : memberMapper.findByGalaxyAndUser(galaxy.getId(), viewer.getId()) != null;
        return GalaxyView.builder()
                .id(galaxy.getId())
                .slug(galaxy.getSlug())
                .name(galaxy.getName())
                .official(Boolean.TRUE.equals(galaxy.getOfficial()))
                .joinMode(galaxy.getJoinMode())
                .description(galaxy.getDescription())
                .coverUrl(galaxy.getCoverUrl())
                .memberCount(memberMapper.countByGalaxyId(galaxy.getId()))
                .contentCount(contentMapper.countByGalaxyId(galaxy.getId()))
                .joined(joined)
                .build();
    }

    public List<GalaxyView> listMine(CommunityUser user) {
        return memberMapper.listByUserId(user.getId()).stream()
                .map(member -> galaxyMapper.selectById(member.getGalaxyId()))
                .filter(galaxy -> galaxy != null)
                .map(this::toView)
                .toList();
    }

    @Transactional
    public GalaxyView join(CommunityUser user, String slug) {
        Galaxy galaxy = requireGalaxy(slug);
        if ("APPROVAL".equalsIgnoreCase(galaxy.getJoinMode())) {
            throw new ContractException(ErrorCode.CONFLICT, "该星系需要申请加入");
        }
        return joinDirect(user, galaxy);
    }

    @Transactional
    public GalaxyJoinRequestView apply(CommunityUser user, String slug, Map<String, String> body) {
        Galaxy galaxy = requireGalaxy(slug);
        if (memberMapper.findByGalaxyAndUser(galaxy.getId(), user.getId()) != null) {
            throw new ContractException(ErrorCode.CONFLICT, "已是星系成员");
        }
        if (!"APPROVAL".equalsIgnoreCase(galaxy.getJoinMode())) {
            joinDirect(user, galaxy);
            return GalaxyJoinRequestView.builder()
                    .id(null)
                    .galaxyId(galaxy.getId())
                    .galaxySlug(galaxy.getSlug())
                    .galaxyName(galaxy.getName())
                    .message(null)
                    .status("APPROVED")
                    .createdAt(Instant.now())
                    .build();
        }
        GalaxyJoinRequest pending = joinRequestMapper.findPending(galaxy.getId(), user.getId());
        if (pending != null) {
            return toJoinRequestView(pending, galaxy);
        }
        GalaxyJoinRequest request = new GalaxyJoinRequest();
        request.setId(TokenSupport.newId());
        request.setGalaxyId(galaxy.getId());
        request.setUserId(user.getId());
        request.setMessage(trimToNull(body == null ? null : body.get("message")));
        request.setStatus("PENDING");
        request.setCreatedAt(Instant.now());
        joinRequestMapper.insert(request);
        return toJoinRequestView(request, galaxy);
    }

    @Transactional
    public void approveJoinRequestForAdmin(String requestId) {
        GalaxyJoinRequest request = joinRequestMapper.selectById(requestId);
        if (request == null || !"PENDING".equals(request.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Galaxy galaxy = galaxyMapper.selectById(request.getGalaxyId());
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        CommunityUser applicant = new CommunityUser();
        applicant.setId(request.getUserId());
        joinDirect(applicant, galaxy);
        request.setStatus("APPROVED");
        request.setResolvedAt(Instant.now());
        joinRequestMapper.updateById(request);
    }

    @Transactional
    public void rejectJoinRequestForAdmin(String requestId) {
        GalaxyJoinRequest request = joinRequestMapper.selectById(requestId);
        if (request == null || !"PENDING".equals(request.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        request.setStatus("REJECTED");
        request.setResolvedAt(Instant.now());
        joinRequestMapper.updateById(request);
    }

    public List<GalaxyJoinRequestView> listPendingJoinRequestsForAdmin(String galaxyId, int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        Galaxy galaxy = galaxyMapper.selectById(galaxyId);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return joinRequestMapper.listPendingByGalaxy(galaxyId, limit).stream()
                .map(request -> toJoinRequestView(request, galaxy))
                .toList();
    }

    /**
     * 自主退出星系（Galaxy Membership Closure，2026-10-10）。
     *
     * <p>语义（以真实模型为准，不虚构契约）：
     * <ul>
     *   <li>非成员（含从未加入与已退出后重复退出）→ 404，与 requireMember 风格一致；</li>
     *   <li>非 MEMBER 角色（当前代码不存在赋值路径，但 role 列预留 MEMBER/ADMIN）
     *       → 409：管理/所有类角色不得自主退出，须先转让或由平台处置——
     *       未来引入 ADMIN/OWNER 角色时该守卫自动生效；</li>
     *   <li>成员行物理删除（uk galaxy_id+user_id 保证单行），memberCount 为实时
     *       COUNT(*)，无需补偿；galaxy_join_request 历史不清理，重新加入走既有
     *       OPEN 直入 / APPROVAL 申请链路，joined_at 为重新加入时间。</li>
     * </ul>
     */
    @Transactional
    public void leave(CommunityUser user, String slug) {
        Galaxy galaxy = requireGalaxy(slug);
        GalaxyMember member = memberMapper.findByGalaxyAndUser(galaxy.getId(), user.getId());
        if (member == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "你不是该星系成员");
        }
        if (!"MEMBER".equals(member.getRole())) {
            throw new ContractException(ErrorCode.CONFLICT, "管理角色不能直接退出星系");
        }
        memberMapper.deleteById(member.getId());
    }

    private GalaxyView joinDirect(CommunityUser user, Galaxy galaxy) {
        if (memberMapper.findByGalaxyAndUser(galaxy.getId(), user.getId()) != null) {
            return toView(galaxy);
        }
        GalaxyMember member = new GalaxyMember();
        member.setId(TokenSupport.newId());
        member.setGalaxyId(galaxy.getId());
        member.setUserId(user.getId());
        member.setRole("MEMBER");
        member.setJoinedAt(Instant.now());
        memberMapper.insert(member);
        return toView(galaxy);
    }

    public List<GalaxyMemberView> listMembers(String slug, int limit) {
        Galaxy galaxy = requireGalaxy(slug);
        if (limit <= 0) {
            limit = 50;
        }
        return memberMapper.listByGalaxyId(galaxy.getId(), limit).stream()
                .map(this::toMemberView)
                .toList();
    }

    /**
     * 星系内容列表（Galaxy Content Contract，2026-10-10 Phase 4.2）。
     *
     * <p>ContentSummary 形状的填充全部走批量：一类一批查活文档
     * （{@code findLiveByTypeAndIds}，removed_at IS NULL——被治理隐藏的内容
     * 自动从星系消失，不再返回）；cover 复用 {@link ContentCoverService}；
     * authorName 复用 {@link HomeFeedEnrichmentService#enrich} 的批量
     * Presentation（viewer 传 null：内容行是静态展示，无 viewer 态）。
     * 文档缺失（未入索引/已下架）的挂载行不产生视图。
     */
    public List<GalaxyContentView> listContent(String slug, int limit) {
        Galaxy galaxy = requireGalaxy(slug);
        if (limit <= 0) {
            limit = 20;
        }
        List<GalaxyContent> rows = contentMapper.listByGalaxyId(galaxy.getId(), limit);
        if (rows.isEmpty()) {
            return List.of();
        }

        // 一类一批取活文档（removed_at IS NULL）
        Map<String, List<String>> idsByType = new java.util.LinkedHashMap<>();
        for (GalaxyContent row : rows) {
            idsByType.computeIfAbsent(row.getObjectType(), k -> new java.util.ArrayList<>())
                    .add(row.getObjectId());
        }
        Map<String, SearchDocument> liveDocs = new java.util.HashMap<>();
        for (Map.Entry<String, List<String>> entry : idsByType.entrySet()) {
            for (SearchDocument doc : searchDocumentMapper.findLiveByTypeAndIds(
                    entry.getKey(), entry.getValue())) {
                liveDocs.put(HomeFeedEnrichmentService.key(doc.getObjectType(), doc.getObjectId()), doc);
            }
        }

        // 批量补 authorName（viewer=null：静态展示，无 viewer 态）
        List<HomeFeedEnrichmentService.FeedObject> refs = rows.stream()
                .map(row -> new HomeFeedEnrichmentService.FeedObject(
                        row.getObjectType(), row.getObjectId()))
                .toList();
        Map<String, HomeFeedEnrichmentService.Presentation> presentations =
                enrichmentService.enrich(refs, null);

        List<GalaxyContentView> views = new java.util.ArrayList<>();
        for (GalaxyContent row : rows) {
            SearchDocument doc = liveDocs.get(
                    HomeFeedEnrichmentService.key(row.getObjectType(), row.getObjectId()));
            if (doc == null) {
                // 未入索引或已下架：挂载前提失效，不产生视图（下架联动）
                continue;
            }
            HomeFeedEnrichmentService.Presentation presentation = presentations.get(
                    HomeFeedEnrichmentService.key(row.getObjectType(), row.getObjectId()));
            views.add(GalaxyContentView.builder()
                    .id(row.getId())
                    .objectType(row.getObjectType())
                    .objectId(row.getObjectId())
                    .title(doc.getTitle())
                    .summary(doc.getSummary())
                    .cover(contentCoverService.resolveCoverUrl(doc))
                    .authorName(presentation == null ? null : presentation.authorName())
                    .updatedAt(doc.getIndexedAt())
                    .pinned(Boolean.TRUE.equals(row.getPinned()))
                    .build());
        }
        return views;
    }

    @Transactional
    public GalaxyContentView addContentForAdmin(String galaxyId, String objectType, String objectId, boolean pinned) {
        Galaxy galaxy = galaxyMapper.selectById(galaxyId);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        // 必须是活文档（removed_at IS NULL）：被治理下架的内容不得通过策展
        // 入口重新挂回星系（旧 findByObject 不看 removed_at，等于给下架内容
        // 留了重公开后门——尽管列表读取会过滤，语义上必须在入口拒绝）。
        if (searchDocumentMapper.findLiveByTypeAndIds(objectType, List.of(objectId)).isEmpty()) {
            throw new ContractException(ErrorCode.NOT_FOUND, "内容不存在或已下架");
        }
        GalaxyContent content = new GalaxyContent();
        content.setId(TokenSupport.newId());
        content.setGalaxyId(galaxyId);
        content.setObjectType(objectType);
        content.setObjectId(objectId);
        content.setPinned(pinned);
        content.setCreatedAt(Instant.now());
        contentMapper.insert(content);
        return toContentView(content);
    }

    @Transactional
    public void removeContentForAdmin(String contentId) {
        GalaxyContent content = contentMapper.selectById(contentId);
        if (content == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        contentMapper.deleteById(contentId);
    }

    @Transactional
    public GalaxyView createForAdmin(Map<String, Object> body) {
        String slug = trimRequired(String.valueOf(body.getOrDefault("slug", "")), "slug");
        if (galaxyMapper.findBySlug(slug) != null) {
            throw new ContractException(ErrorCode.CONFLICT, "星系别名已存在");
        }
        String seedKey = trimToNull(String.valueOf(body.getOrDefault("seedKey", "")));
        if (seedKey == null) {
            seedKey = slug;
        }
        Galaxy galaxy = new Galaxy();
        galaxy.setId(TokenSupport.newId());
        galaxy.setSeedKey(seedKey);
        galaxy.setSlug(slug);
        galaxy.setName(trimRequired(String.valueOf(body.getOrDefault("name", "")), "name"));
        galaxy.setOfficial(parseBoolean(body.get("official"), false));
        // create：INSERT 缺列即默认 NULL，直接内联解析（可空列语义与 update 一致）
        if (body.containsKey("description")) {
            Object raw = body.get("description");
            String description = raw == null ? null : trimToNull(String.valueOf(raw));
            if ("null".equals(description)) {
                description = null;
            }
            if (description != null && description.length() > 512) {
                throw new FieldContractException("description", "简介不能超过 512 字");
            }
            galaxy.setDescription(description);
        }
        if (body.containsKey("coverUrl")) {
            Object raw = body.get("coverUrl");
            String coverUrl = raw == null ? null : trimToNull(String.valueOf(raw));
            if ("null".equals(coverUrl)) {
                coverUrl = null;
            }
            if (coverUrl != null && coverUrl.length() > 512) {
                throw new FieldContractException("coverUrl", "封面地址不能超过 512 字");
            }
            galaxy.setCoverUrl(coverUrl);
        }
        galaxyMapper.insert(galaxy);
        return toView(galaxy);
    }

    @Transactional
    public GalaxyView updateForAdmin(String galaxyId, Map<String, Object> body) {
        Galaxy galaxy = galaxyMapper.selectById(galaxyId);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        // 全字段走显式 SET（D3 纪律）：updateById 的 MyBatis-Plus NOT_NULL 策略会
        // 省略 null 字段，"显式 null = 清空"的语义永远落不了库。字段校验先行。
        UpdateWrapper<Galaxy> update = new UpdateWrapper<Galaxy>().eq("id", galaxyId);
        boolean hasUpdate = false;
        if (body.containsKey("name")) {
            update.set("name", trimRequired(String.valueOf(body.get("name")), "name"));
            hasUpdate = true;
        }
        if (body.containsKey("official")) {
            update.set("official", parseBoolean(body.get("official"), galaxy.getOfficial()));
            hasUpdate = true;
        }
        if (body.containsKey("joinMode")) {
            String joinMode = String.valueOf(body.get("joinMode")).trim().toUpperCase();
            if (!"OPEN".equals(joinMode) && !"APPROVAL".equals(joinMode)) {
                throw new FieldContractException("joinMode", "入群模式无效");
            }
            update.set("join_mode", joinMode);
            hasUpdate = true;
        }
        if (body.containsKey("description")) {
            Object raw = body.get("description");
            String description = raw == null ? null : trimToNull(String.valueOf(raw));
            if ("null".equals(description)) {
                description = null;
            }
            if (description != null && description.length() > 512) {
                throw new FieldContractException("description", "简介不能超过 512 字");
            }
            update.set("description", description);
            hasUpdate = true;
        }
        if (body.containsKey("coverUrl")) {
            Object raw = body.get("coverUrl");
            String coverUrl = raw == null ? null : trimToNull(String.valueOf(raw));
            if ("null".equals(coverUrl)) {
                coverUrl = null;
            }
            if (coverUrl != null && coverUrl.length() > 512) {
                throw new FieldContractException("coverUrl", "封面地址不能超过 512 字");
            }
            update.set("cover_url", coverUrl);
            hasUpdate = true;
        }
        if (hasUpdate) {
            galaxyMapper.update(null, update);
        }
        galaxy = galaxyMapper.selectById(galaxyId);
        return toView(galaxy);
    }

    private Galaxy requireGalaxy(String slug) {
        Galaxy galaxy = galaxyMapper.findBySlug(slug);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return galaxy;
    }

    private GalaxyMemberView toMemberView(GalaxyMember member) {
        CommunityProfile profile = profileMapper.findByUserId(member.getUserId());
        return GalaxyMemberView.builder()
                .userId(member.getUserId())
                .username(profile == null ? member.getUserId() : profile.getUsername())
                .displayName(profile == null ? null : profile.getDisplayName())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .build();
    }

    /**
     * admin 挂载返回的精简视图：只做存在性确认，不做富化——
     * 富化属于公开列表契约（listContent），挂载响应里逐行查文档是纯浪费。
     * summary/cover/authorName 为 null，前端以 listContent 刷新为准。
     */
    private GalaxyContentView toContentView(GalaxyContent content) {
        return GalaxyContentView.builder()
                .id(content.getId())
                .objectType(content.getObjectType())
                .objectId(content.getObjectId())
                .pinned(Boolean.TRUE.equals(content.getPinned()))
                .build();
    }

    /**
     * 公共展示视图（列表/详情共用）。description/coverUrl 由 V051 列直接透传
     * （SchemaMigrator 是 ApplicationRunner：启动即执行 pending 迁移，实体加列
     * 与迁移执行在同一启动生命周期内达成一致，不会出现 Unknown column）。
     * joined/contentCount 仅由 {@link #getBySlug} 填充——列表端点不逐行查
     * viewer 状态（N+1），builder 缺省即 null。
     */
    private GalaxyView toView(Galaxy galaxy) {
        return GalaxyView.builder()
                .id(galaxy.getId())
                .slug(galaxy.getSlug())
                .name(galaxy.getName())
                .official(Boolean.TRUE.equals(galaxy.getOfficial()))
                .joinMode(galaxy.getJoinMode())
                .description(galaxy.getDescription())
                .coverUrl(galaxy.getCoverUrl())
                .memberCount(memberMapper.countByGalaxyId(galaxy.getId()))
                .build();
    }

    private GalaxyJoinRequestView toJoinRequestView(GalaxyJoinRequest request, Galaxy galaxy) {
        return GalaxyJoinRequestView.builder()
                .id(request.getId())
                .galaxyId(galaxy.getId())
                .galaxySlug(galaxy.getSlug())
                .galaxyName(galaxy.getName())
                .message(request.getMessage())
                .status(request.getStatus())
                .createdAt(request.getCreatedAt())
                .build();
    }

    private static String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "不能为空");
        }
        return raw.trim();
    }

    private static boolean parseBoolean(Object raw, boolean defaultValue) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(raw));
    }
}
