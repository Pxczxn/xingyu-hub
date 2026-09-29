package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.EventSubmissionAdminView;
import top.pxczxn.xingyu.community.dto.EventSubmissionView;
import top.pxczxn.xingyu.community.dto.EventView;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.EventSubmission;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommunityEventMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.entity.EventRegistration;
import top.pxczxn.xingyu.community.mapper.EventRegistrationMapper;
import top.pxczxn.xingyu.community.mapper.EventSubmissionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
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
public class CommunityEventService {

    private final CommunityEventMapper eventMapper;
    private final EventSubmissionMapper submissionMapper;
    private final EventRegistrationMapper registrationMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CommunityProfileMapper profileMapper;

    public List<EventView> listActive(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return eventMapper.listActive(limit).stream().map(this::toView).toList();
    }

    public EventView getById(String eventId) {
        CommunityEvent event = requireActiveEvent(eventId);
        return toView(event);
    }

    @Transactional
    public Map<String, Object> register(CommunityUser user, String eventId) {
        CommunityEvent event = requireActiveEvent(eventId);
        EventRegistration existing = registrationMapper.findByEventAndUser(eventId, user.getId());
        if (existing != null && "REGISTERED".equals(existing.getStatus())) {
            return registrationStatus(existing);
        }
        Instant now = Instant.now();
        if (existing == null) {
            EventRegistration registration = new EventRegistration();
            registration.setId(TokenSupport.newId());
            registration.setEventId(eventId);
            registration.setUserId(user.getId());
            registration.setStatus("REGISTERED");
            registration.setCreatedAt(now);
            registrationMapper.insert(registration);
            return registrationStatus(registration);
        }
        existing.setStatus("REGISTERED");
        existing.setCancelledAt(null);
        registrationMapper.updateById(existing);
        return registrationStatus(existing);
    }

    @Transactional
    public void cancelRegistration(CommunityUser user, String eventId) {
        requireActiveEvent(eventId);
        EventRegistration existing = registrationMapper.findByEventAndUser(eventId, user.getId());
        if (existing == null || !"REGISTERED".equals(existing.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        existing.setStatus("CANCELLED");
        existing.setCancelledAt(Instant.now());
        registrationMapper.updateById(existing);
    }

    @Transactional
    public EventSubmissionView submit(CommunityUser user, String eventId, Map<String, String> body) {
        CommunityEvent event = requireActiveEvent(eventId);
        if (!Boolean.TRUE.equals(event.getSubmissionOpen())) {
            throw new ContractException(ErrorCode.CONFLICT, "活动投稿已关闭");
        }
        String objectType = normalizeObjectType(body.get("objectType"));
        String objectId = trimRequired(body.get("objectId"), "objectId");
        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "投稿内容不存在");
        }
        EventSubmission existing = submissionMapper.findByEventAndObject(eventId, user.getId(), objectType, objectId);
        if (existing != null) {
            return toSubmissionView(existing);
        }
        EventSubmission submission = new EventSubmission();
        submission.setId(TokenSupport.newId());
        submission.setEventId(eventId);
        submission.setAuthorId(user.getId());
        submission.setObjectType(objectType);
        submission.setObjectId(objectId);
        submission.setNote(trimToNull(body.get("note")));
        submission.setStatus("SUBMITTED");
        submission.setCreatedAt(Instant.now());
        submissionMapper.insert(submission);
        return toSubmissionView(submission);
    }

    public List<EventSubmissionView> listMySubmissions(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return submissionMapper.listByAuthorId(user.getId(), limit).stream()
                .map(this::toSubmissionView)
                .toList();
    }

    public List<EventSubmissionView> listAcceptedSubmissions(String eventId, int limit) {
        requireActiveEvent(eventId);
        if (limit <= 0) {
            limit = 50;
        }
        return submissionMapper.listAcceptedByEventId(eventId, limit).stream()
                .map(this::toSubmissionView)
                .toList();
    }

    public List<EventSubmissionAdminView> listSubmissionsForAdmin(String eventId, int limit) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (limit <= 0) {
            limit = 100;
        }
        return submissionMapper.listByEventId(eventId, limit).stream()
                .map(this::toAdminSubmissionView)
                .toList();
    }

    @Transactional
    public EventSubmissionAdminView reviewSubmissionForAdmin(String submissionId, Map<String, String> body) {
        EventSubmission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        String status = normalizeReviewStatus(body.get("status"));
        submission.setStatus(status);
        submissionMapper.updateById(submission);
        return toAdminSubmissionView(submission);
    }

    public List<CommunityEvent> listForAdmin(int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        return eventMapper.listAll(limit);
    }

    @Transactional
    public CommunityEvent createForAdmin(Map<String, Object> body) {
        Instant now = Instant.now();
        String slug = trimRequired(String.valueOf(body.getOrDefault("slug", "")), "slug");
        if (eventMapper.findBySlug(slug) != null) {
            throw new ContractException(ErrorCode.CONFLICT, "活动别名已存在");
        }
        CommunityEvent event = new CommunityEvent();
        event.setId(TokenSupport.newId());
        event.setSlug(slug);
        event.setTitle(trimRequired(String.valueOf(body.getOrDefault("title", "")), "title"));
        event.setBody(String.valueOf(body.getOrDefault("body", "")).trim());
        event.setStatus(String.valueOf(body.getOrDefault("status", "ACTIVE")).trim().toUpperCase(Locale.ROOT));
        event.setSubmissionOpen(parseBoolean(body.get("submissionOpen"), true));
        event.setStartsAt(now);
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        eventMapper.insert(event);
        return event;
    }

    @Transactional
    public CommunityEvent updateForAdmin(String eventId, Map<String, Object> body) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (body.containsKey("title")) {
            event.setTitle(trimRequired(String.valueOf(body.get("title")), "title"));
        }
        if (body.containsKey("body")) {
            event.setBody(String.valueOf(body.get("body")).trim());
        }
        if (body.containsKey("status")) {
            event.setStatus(String.valueOf(body.get("status")).trim().toUpperCase(Locale.ROOT));
        }
        if (body.containsKey("submissionOpen")) {
            event.setSubmissionOpen(parseBoolean(body.get("submissionOpen"), event.getSubmissionOpen()));
        }
        event.setUpdatedAt(Instant.now());
        eventMapper.updateById(event);
        return event;
    }

    private CommunityEvent requireActiveEvent(String eventId) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null || !"ACTIVE".equals(event.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return event;
    }

    private EventView toView(CommunityEvent event) {
        return EventView.builder()
                .id(event.getId())
                .slug(event.getSlug())
                .title(event.getTitle())
                .body(event.getBody())
                .startsAt(event.getStartsAt())
                .endsAt(event.getEndsAt())
                .submissionOpen(Boolean.TRUE.equals(event.getSubmissionOpen()))
                .build();
    }

    private Map<String, Object> registrationStatus(EventRegistration registration) {
        return Map.of(
                "id", registration.getId(),
                "eventId", registration.getEventId(),
                "status", registration.getStatus(),
                "createdAt", registration.getCreatedAt());
    }

    private EventSubmissionView toSubmissionView(EventSubmission submission) {
        SearchDocument document = searchDocumentMapper.findByObject(
                submission.getObjectType(), submission.getObjectId());
        return EventSubmissionView.builder()
                .id(submission.getId())
                .eventId(submission.getEventId())
                .objectType(submission.getObjectType())
                .objectId(submission.getObjectId())
                .objectTitle(document == null ? null : document.getTitle())
                .note(submission.getNote())
                .status(submission.getStatus())
                .createdAt(submission.getCreatedAt())
                .build();
    }

    private EventSubmissionAdminView toAdminSubmissionView(EventSubmission submission) {
        SearchDocument document = searchDocumentMapper.findByObject(
                submission.getObjectType(), submission.getObjectId());
        CommunityProfile profile = profileMapper.findByUserId(submission.getAuthorId());
        return EventSubmissionAdminView.builder()
                .id(submission.getId())
                .eventId(submission.getEventId())
                .authorId(submission.getAuthorId())
                .authorUsername(profile == null ? submission.getAuthorId() : profile.getUsername())
                .authorDisplayName(profile == null ? null : profile.getDisplayName())
                .objectType(submission.getObjectType())
                .objectId(submission.getObjectId())
                .objectTitle(document == null ? submission.getObjectId() : document.getTitle())
                .note(submission.getNote())
                .status(submission.getStatus())
                .createdAt(submission.getCreatedAt())
                .build();
    }

    private static String normalizeReviewStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("status", "审核状态不能为空");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACCEPTED", "APPROVED" -> "ACCEPTED";
            case "REJECTED", "DISMISSED" -> "REJECTED";
            default -> throw new FieldContractException("status", "审核状态无效");
        };
    }

    private static String normalizeObjectType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "对象标识不能为空");
        }
        return raw.trim();
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
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
