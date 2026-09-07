package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
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

    public List<GalaxyView> list() {
        return galaxyMapper.listAll().stream().map(this::toView).toList();
    }

    public GalaxyView getBySlug(String slug) {
        Galaxy galaxy = requireGalaxy(slug);
        return toView(galaxy);
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

    public List<GalaxyContentView> listContent(String slug, int limit) {
        Galaxy galaxy = requireGalaxy(slug);
        if (limit <= 0) {
            limit = 20;
        }
        return contentMapper.listByGalaxyId(galaxy.getId(), limit).stream()
                .map(this::toContentView)
                .toList();
    }

    @Transactional
    public GalaxyContentView addContentForAdmin(String galaxyId, String objectType, String objectId, boolean pinned) {
        Galaxy galaxy = galaxyMapper.selectById(galaxyId);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "内容不存在");
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
        galaxyMapper.insert(galaxy);
        return toView(galaxy);
    }

    @Transactional
    public GalaxyView updateForAdmin(String galaxyId, Map<String, Object> body) {
        Galaxy galaxy = galaxyMapper.selectById(galaxyId);
        if (galaxy == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (body.containsKey("name")) {
            galaxy.setName(trimRequired(String.valueOf(body.get("name")), "name"));
        }
        if (body.containsKey("official")) {
            galaxy.setOfficial(parseBoolean(body.get("official"), galaxy.getOfficial()));
        }
        if (body.containsKey("joinMode")) {
            String joinMode = String.valueOf(body.get("joinMode")).trim().toUpperCase();
            if (!"OPEN".equals(joinMode) && !"APPROVAL".equals(joinMode)) {
                throw new FieldContractException("joinMode", "入群模式无效");
            }
            galaxy.setJoinMode(joinMode);
        }
        galaxyMapper.updateById(galaxy);
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

    private GalaxyContentView toContentView(GalaxyContent content) {
        SearchDocument document = searchDocumentMapper.findByObject(content.getObjectType(), content.getObjectId());
        return GalaxyContentView.builder()
                .id(content.getId())
                .objectType(content.getObjectType())
                .objectId(content.getObjectId())
                .title(document == null ? content.getObjectId() : document.getTitle())
                .pinned(Boolean.TRUE.equals(content.getPinned()))
                .build();
    }

    private GalaxyView toView(Galaxy galaxy) {
        return GalaxyView.builder()
                .id(galaxy.getId())
                .slug(galaxy.getSlug())
                .name(galaxy.getName())
                .official(Boolean.TRUE.equals(galaxy.getOfficial()))
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
