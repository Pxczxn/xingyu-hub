package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.CommentDetailView;
import top.pxczxn.xingyu.community.dto.CommentView;
import top.pxczxn.xingyu.community.service.CollectionService;
import top.pxczxn.xingyu.community.service.SocialService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class CommunitySocialController {

    private final SocialService socialService;
    private final CollectionService collectionService;

    @PostMapping("/likes/{objectType}/{objectId}")
    public ResponseEntity<Void> like(
            @PathVariable String objectType,
            @PathVariable String objectId) {
        socialService.like(CommunityAuthContext.requireUser(), objectType.toUpperCase(), objectId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/likes/{objectType}/{objectId}")
    public ResponseEntity<Void> unlike(
            @PathVariable String objectType,
            @PathVariable String objectId) {
        socialService.unlike(CommunityAuthContext.requireUser(), objectType.toUpperCase(), objectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/likes/{objectType}/{objectId}/count")
    public Map<String, Long> likeCount(
            @PathVariable String objectType,
            @PathVariable String objectId) {
        return Map.of("count", socialService.likeCount(objectType.toUpperCase(), objectId));
    }

    @GetMapping("/likes/{objectType}/{objectId}/status")
    public Map<String, Boolean> likeStatus(
            @PathVariable String objectType,
            @PathVariable String objectId) {
        return Map.of(
                "liked",
                socialService.isLiked(
                        CommunityAuthContext.requireUser(), objectType.toUpperCase(), objectId));
    }

    @GetMapping("/bookmarks/status")
    public Map<String, Boolean> bookmarkStatus(
            @RequestParam String objectType,
            @RequestParam String objectId) {
        return Map.of(
                "bookmarked",
                collectionService.isBookmarked(
                        CommunityAuthContext.requireUser(), objectType.toUpperCase(), objectId));
    }

    @PostMapping("/follows/creators/{creatorId}")
    public ResponseEntity<Void> followCreator(@PathVariable String creatorId) {
        socialService.followCreator(CommunityAuthContext.requireUser(), creatorId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/follows/creators/{creatorId}")
    public ResponseEntity<Void> unfollowCreator(@PathVariable String creatorId) {
        socialService.unfollowCreator(CommunityAuthContext.requireUser(), creatorId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/follows/topics/{topicId}")
    public ResponseEntity<Void> followTopic(@PathVariable String topicId) {
        socialService.followTopic(CommunityAuthContext.requireUser(), topicId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/follows/topics/{topicId}")
    public ResponseEntity<Void> unfollowTopic(@PathVariable String topicId) {
        socialService.unfollowTopic(CommunityAuthContext.requireUser(), topicId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/comments")
    public CommentView createComment(@RequestBody Map<String, String> body) {
        return socialService.createComment(CommunityAuthContext.requireUser(), body);
    }

    @GetMapping("/comments/{objectType}/{objectId}")
    public List<CommentView> listComments(
            @PathVariable String objectType,
            @PathVariable String objectId) {
        return socialService.listComments(objectType.toUpperCase(), objectId);
    }

    @GetMapping("/comments/lookup/{commentId}")
    public CommentDetailView getComment(@PathVariable String commentId) {
        return socialService.getComment(commentId);
    }

    @PatchMapping("/comments/{commentId}")
    public CommentView editComment(
            @PathVariable String commentId,
            @RequestBody Map<String, String> body) {
        return socialService.editComment(CommunityAuthContext.requireUser(), commentId, body);
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable String commentId) {
        socialService.deleteComment(CommunityAuthContext.requireUser(), commentId);
        return ResponseEntity.noContent().build();
    }
}
