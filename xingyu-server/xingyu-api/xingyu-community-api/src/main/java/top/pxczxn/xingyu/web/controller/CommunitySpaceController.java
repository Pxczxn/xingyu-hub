package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.dto.SpacePublicView;
import top.pxczxn.xingyu.community.dto.SpaceWorksView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.CreationSpaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/spaces")
@RequiredArgsConstructor
public class CommunitySpaceController {

    private final CreationSpaceService creationSpaceService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping("/{spaceSlug}")
    public SpacePublicView space(
            @PathVariable String spaceSlug,
            @RequestHeader(value = "satoken", required = false) String token) {
        return creationSpaceService.getPublicSpace(spaceSlug, resolveViewer(token));
    }

    @GetMapping("/{spaceSlug}/works")
    public SpaceWorksView works(
            @PathVariable String spaceSlug,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit,
            @RequestHeader(value = "satoken", required = false) String token) {
        return creationSpaceService.getPublicWorksBySpaceSlug(
                spaceSlug, resolveViewer(token), category, limit);
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
