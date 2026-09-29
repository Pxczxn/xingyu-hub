package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.AnnouncementView;
import top.pxczxn.xingyu.community.entity.Announcement;
import top.pxczxn.xingyu.community.mapper.AnnouncementMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementMapper announcementMapper;

    public List<AnnouncementView> listPublished(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return announcementMapper.listPublished(limit).stream()
                .map(this::toView)
                .toList();
    }

    public AnnouncementView getById(String id) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null || !"PUBLISHED".equals(announcement.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(announcement);
    }

    public List<Announcement> listForAdmin() {
        return announcementMapper.listAllForAdmin();
    }

    @Transactional
    public Announcement createForAdmin(Map<String, Object> body) {
        String title = trimRequired(String.valueOf(body.getOrDefault("title", "")), "title");
        String content = trimRequired(String.valueOf(body.getOrDefault("body", "")), "body");
        Instant now = Instant.now();
        Announcement item = new Announcement();
        item.setId(TokenSupport.newId());
        item.setTitle(title);
        item.setBody(content);
        item.setStatus("PUBLISHED");
        item.setCreatedAt(now);
        item.setPublishedAt(now);
        announcementMapper.insert(item);
        return item;
    }

    @Transactional
    public Announcement updateStatusForAdmin(String id, Map<String, String> body) {
        Announcement announcement = announcementMapper.selectById(id);
        if (announcement == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        String status = normalizeStatus(body.get("status"));
        announcement.setStatus(status);
        if ("PUBLISHED".equals(status) && announcement.getPublishedAt() == null) {
            announcement.setPublishedAt(Instant.now());
        }
        announcementMapper.updateById(announcement);
        return announcement;
    }

    private AnnouncementView toView(Announcement announcement) {
        return AnnouncementView.builder()
                .id(announcement.getId())
                .title(announcement.getTitle())
                .body(announcement.getBody())
                .publishedAt(announcement.getPublishedAt())
                .build();
    }

    private static String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("status", "状态不能为空");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PUBLISHED", "DRAFT", "ARCHIVED" -> normalized;
            case "UNPUBLISHED" -> "DRAFT";
            default -> throw new FieldContractException("status", "状态无效");
        };
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "不能为空");
        }
        return raw.trim();
    }
}
