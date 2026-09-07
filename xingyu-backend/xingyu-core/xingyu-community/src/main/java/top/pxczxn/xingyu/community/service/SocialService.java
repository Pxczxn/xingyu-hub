package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.CommentDetailView;
import top.pxczxn.xingyu.community.dto.CommentView;
import top.pxczxn.xingyu.community.dto.FollowUserView;
import top.pxczxn.xingyu.community.dto.MyCommentView;
import top.pxczxn.xingyu.community.dto.MyLikeView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ContentLike;
import top.pxczxn.xingyu.community.entity.CreatorFollow;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.entity.TopicFollow;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import top.pxczxn.xingyu.community.mapper.CreatorFollowMapper;
import top.pxczxn.xingyu.community.mapper.TopicFollowMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.config.CommunityProperties;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SocialService {

    private final ContentLikeMapper likeMapper;
    private final CreatorFollowMapper creatorFollowMapper;
    private final TopicFollowMapper topicFollowMapper;
    private final CommentMapper commentMapper;
    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
    private final TopicMapper topicMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CommunityProperties communityProperties;

    @Transactional
    public void like(CommunityUser user, String objectType, String objectId) {
        validateObjectType(objectType);
        if (likeMapper.findByUserAndObject(user.getId(), objectType, objectId) != null) {
            return;
        }
        ContentLike like = new ContentLike();
        like.setId(TokenSupport.newId());
        like.setUserId(user.getId());
        like.setObjectType(objectType);
        like.setObjectId(objectId);
        like.setCreatedAt(Instant.now());
        likeMapper.insert(like);
    }

    @Transactional
    public void unlike(CommunityUser user, String objectType, String objectId) {
        validateObjectType(objectType);
        likeMapper.deleteByUserAndObject(user.getId(), objectType, objectId);
    }

    public long likeCount(String objectType, String objectId) {
        return likeMapper.countByObject(objectType, objectId);
    }

    public boolean isLiked(CommunityUser user, String objectType, String objectId) {
        return likeMapper.findByUserAndObject(user.getId(), objectType, objectId) != null;
    }

    @Transactional
    public void followCreator(CommunityUser user, String creatorId) {
        if (user.getId().equals(creatorId)) {
            throw new FieldContractException("creatorId", "不能关注自己");
        }
        if (userMapper.selectById(creatorId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (creatorFollowMapper.findByFollowerAndCreator(user.getId(), creatorId) != null) {
            return;
        }
        CreatorFollow follow = new CreatorFollow();
        follow.setId(TokenSupport.newId());
        follow.setFollowerId(user.getId());
        follow.setCreatorId(creatorId);
        follow.setCreatedAt(Instant.now());
        creatorFollowMapper.insert(follow);
    }

    @Transactional
    public void unfollowCreator(CommunityUser user, String creatorId) {
        creatorFollowMapper.deleteByFollowerAndCreator(user.getId(), creatorId);
    }

    @Transactional
    public void followTopic(CommunityUser user, String topicId) {
        Topic topic = topicMapper.selectById(topicId);
        if (topic == null || !"ENABLED".equals(topic.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (topicFollowMapper.findByUserAndTopic(user.getId(), topicId) != null) {
            return;
        }
        TopicFollow follow = new TopicFollow();
        follow.setId(TokenSupport.newId());
        follow.setUserId(user.getId());
        follow.setTopicId(topicId);
        follow.setCreatedAt(Instant.now());
        topicFollowMapper.insert(follow);
    }

    @Transactional
    public void unfollowTopic(CommunityUser user, String topicId) {
        topicFollowMapper.deleteByUserAndTopic(user.getId(), topicId);
    }

    @Transactional
    public CommentView createComment(CommunityUser user, Map<String, String> body) {
        String objectType = body.get("objectType");
        String objectId = body.get("objectId");
        String commentBody = body.get("body");
        validateObjectType(objectType);
        if (objectId == null || objectId.isBlank()) {
            throw new FieldContractException("objectId", "对象标识不能为空");
        }
        if (commentBody == null || commentBody.isBlank()) {
            throw new FieldContractException("body", "评论内容不能为空");
        }
        Instant now = Instant.now();
        Comment comment = new Comment();
        comment.setId(TokenSupport.newId());
        comment.setObjectType(objectType);
        comment.setObjectId(objectId);
        comment.setAuthorId(user.getId());
        comment.setParentId(trimToNull(body.get("parentId")));
        comment.setBody(commentBody.trim());
        comment.setStatus("VISIBLE");
        comment.setCreatedAt(now);
        comment.setUpdatedAt(now);
        commentMapper.insert(comment);
        return toView(comment);
    }

    public List<CommentView> listComments(String objectType, String objectId) {
        validateObjectType(objectType);
        return commentMapper.listVisibleByObject(objectType, objectId).stream()
                .map(this::toView)
                .toList();
    }

    public CommentDetailView getComment(String commentId) {
        Comment comment = commentMapper.selectById(commentId);
        if (comment == null || !"VISIBLE".equals(comment.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toDetailView(comment);
    }

    @Transactional
    public CommentView editComment(CommunityUser user, String commentId, Map<String, String> body) {
        Comment comment = commentMapper.selectById(commentId);
        if (comment == null || !"VISIBLE".equals(comment.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!user.getId().equals(comment.getAuthorId())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN);
        }
        long elapsed = Instant.now().getEpochSecond() - comment.getCreatedAt().getEpochSecond();
        if (elapsed > communityProperties.getCommentEditWindowSeconds()) {
            throw new ContractException(ErrorCode.CONFLICT, "已超过可编辑时间窗口");
        }
        String newBody = body.get("body");
        if (newBody == null || newBody.isBlank()) {
            throw new FieldContractException("body", "评论内容不能为空");
        }
        comment.setBody(newBody.trim());
        comment.setUpdatedAt(Instant.now());
        commentMapper.updateById(comment);
        return toView(comment);
    }

    @Transactional
    public void deleteComment(CommunityUser user, String commentId) {
        Comment comment = commentMapper.selectById(commentId);
        if (comment == null || "DELETED".equals(comment.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!user.getId().equals(comment.getAuthorId())) {
            throw new ContractException(ErrorCode.AUTH_FORBIDDEN);
        }
        comment.setStatus("DELETED");
        comment.setUpdatedAt(Instant.now());
        commentMapper.updateById(comment);
    }

    public PageResultView<FollowUserView> listFollowing(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<String> creatorIds = creatorFollowMapper.listCreatorIdsByFollower(user.getId());
        List<FollowUserView> items = creatorIds.stream()
                .limit(limit)
                .map(creatorId -> toFollowUserView(user.getId(), creatorId, true))
                .filter(Objects::nonNull)
                .toList();
        return PageResultView.<FollowUserView>builder()
                .items(items)
                .nextCursor(null)
                .total((long) items.size())
                .build();
    }

    public PageResultView<FollowUserView> listFollowers(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<String> followerIds = creatorFollowMapper.listFollowerIdsByCreator(user.getId(), limit);
        List<FollowUserView> items = followerIds.stream()
                .map(followerId -> toFollowUserView(followerId, user.getId(), false))
                .filter(Objects::nonNull)
                .toList();
        return PageResultView.<FollowUserView>builder()
                .items(items)
                .nextCursor(null)
                .total(creatorFollowMapper.countFollowers(user.getId()))
                .build();
    }

    public List<MyCommentView> listMyComments(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return commentMapper.listByAuthorId(user.getId(), limit).stream()
                .map(this::toMyCommentView)
                .toList();
    }

    public List<MyLikeView> listMyLikes(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return likeMapper.listByUserId(user.getId(), limit).stream()
                .map(this::toMyLikeView)
                .toList();
    }

    private FollowUserView toFollowUserView(String followerId, String creatorId, boolean followingList) {
        String targetUserId = followingList ? creatorId : followerId;
        CommunityProfile profile = profileMapper.findByUserId(targetUserId);
        if (profile == null) {
            return null;
        }
        CreatorFollow follow = creatorFollowMapper.findByFollowerAndCreator(followerId, creatorId);
        return FollowUserView.builder()
                .userId(targetUserId)
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .followedAt(follow == null ? null : follow.getCreatedAt())
                .build();
    }

    private MyCommentView toMyCommentView(Comment comment) {
        SearchDocument document = searchDocumentMapper.findByObject(comment.getObjectType(), comment.getObjectId());
        return MyCommentView.builder()
                .id(comment.getId())
                .body(comment.getBody())
                .objectType(comment.getObjectType())
                .objectId(comment.getObjectId())
                .objectTitle(document == null ? comment.getObjectId() : document.getTitle())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    private MyLikeView toMyLikeView(ContentLike like) {
        SearchDocument document = searchDocumentMapper.findByObject(like.getObjectType(), like.getObjectId());
        return MyLikeView.builder()
                .objectType(like.getObjectType())
                .objectId(like.getObjectId())
                .title(document == null ? like.getObjectId() : document.getTitle())
                .createdAt(like.getCreatedAt())
                .build();
    }

    private CommentDetailView toDetailView(Comment comment) {
        String authorUsername = null;
        CommunityProfile profile = profileMapper.findByUserId(comment.getAuthorId());
        if (profile != null) {
            authorUsername = profile.getUsername();
        }
        return CommentDetailView.builder()
                .id(comment.getId())
                .authorId(comment.getAuthorId())
                .authorUsername(authorUsername)
                .parentId(comment.getParentId())
                .body(comment.getBody())
                .objectType(comment.getObjectType())
                .objectId(comment.getObjectId())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    private CommentView toView(Comment comment) {
        String authorUsername = null;
        CommunityProfile profile = profileMapper.findByUserId(comment.getAuthorId());
        if (profile != null) {
            authorUsername = profile.getUsername();
        }
        return CommentView.builder()
                .id(comment.getId())
                .authorId(comment.getAuthorId())
                .authorUsername(authorUsername)
                .parentId(comment.getParentId())
                .body(comment.getBody())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    public List<FollowUserView> listSuggestedCreators(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 10;
        }
        return profileMapper.listSuggested(user.getId(), limit).stream()
                .map(profile -> FollowUserView.builder()
                        .userId(profile.getUserId())
                        .username(profile.getUsername())
                        .displayName(profile.getDisplayName())
                        .build())
                .toList();
    }

    private static void validateObjectType(String objectType) {
        if (objectType == null || objectType.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
