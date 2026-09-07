package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.dto.FollowUserView;
import top.pxczxn.xingyu.community.dto.PublicUserView;
import top.pxczxn.xingyu.community.dto.SpaceWorksView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.CommunityProfileService;
import top.pxczxn.xingyu.community.service.CreationSpaceService;
import top.pxczxn.xingyu.community.service.SocialService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class CommunityUserController {

    private final CommunityProfileService profileService;
    private final CommunityAccountService accountService;
    private final CreationSpaceService creationSpaceService;
    private final CommunityUserMapper userMapper;
    private final CommunityProfileMapper profileMapper;
    private final SocialService socialService;

    @GetMapping("/suggested")
    public List<FollowUserView> suggested(
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return socialService.listSuggestedCreators(CommunityAuthContext.requireUser(), limit);
    }

    @GetMapping("/{username}")
    public PublicUserView publicProfile(
            @PathVariable String username,
            @RequestHeader(value = "satoken", required = false) String token) {
        CommunityUser viewer = resolveViewer(token);
        return profileService.getPublicProfile(username, viewer);
    }

    @GetMapping("/{username}/works")
    public SpaceWorksView works(
            @PathVariable String username,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit,
            @RequestHeader(value = "satoken", required = false) String token) {
        return creationSpaceService.getPublicWorks(username, resolveViewer(token), category, limit);
    }

    @GetMapping("/{username}/works/categories")
    public List<SpaceWorksView.CategorySummary> workCategories(
            @PathVariable String username,
            @RequestHeader(value = "satoken", required = false) String token) {
        return creationSpaceService.getPublicCategories(username, resolveViewer(token));
    }

    @PostMapping("/{username}/follow")
    public ResponseEntity<Void> follow(@PathVariable String username) {
        socialService.followCreator(CommunityAuthContext.requireUser(), resolveUserId(username));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{username}/follow")
    public ResponseEntity<Void> unfollow(@PathVariable String username) {
        socialService.unfollowCreator(CommunityAuthContext.requireUser(), resolveUserId(username));
        return ResponseEntity.noContent().build();
    }

    private String resolveUserId(String username) {
        CommunityProfile profile = profileMapper.findByUsername(username);
        if (profile == null) {
            throw new ContractException(top.pxczxn.xingyu.common.contract.ErrorCode.NOT_FOUND);
        }
        return profile.getUserId();
    }

    private CommunityUser resolveViewer(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            CommunitySession session = accountService.requireActiveSession(token);
            return userMapper.selectById(session.getUserId());
        } catch (ContractException ex) {
            return null;
        }
    }
}
