package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.ExploreDomainView;
import top.pxczxn.xingyu.community.dto.ExploreNavView;
import top.pxczxn.xingyu.community.dto.UserExploreView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.ExplorationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/explore")
@RequiredArgsConstructor
public class CommunityExploreController {

    private final ExplorationService explorationService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping("/map")
    public List<ExploreDomainView> map() {
        return explorationService.listOfficialMap();
    }

    @GetMapping("/nav")
    public ExploreNavView nav(@RequestHeader(value = "satoken", required = false) String token) {
        return explorationService.composeNav(resolveViewer(token));
    }

    @GetMapping("/feed")
    public List<ContentCardView> feed(
            @RequestHeader(value = "satoken", required = false) String token,
            @RequestParam(value = "domain", defaultValue = "tech") String domain,
            @RequestParam(value = "sort", defaultValue = "featured") String sort,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return explorationService.feedForDomain(resolveViewer(token), domain, sort, limit);
    }

    @GetMapping("/me")
    public UserExploreView myExploration(@RequestHeader("satoken") String token) {
        return explorationService.getUserExploration(requireUser(token));
    }

    @PutMapping("/me")
    public UserExploreView updateMyExploration(
            @RequestHeader("satoken") String token,
            @RequestBody Map<String, Object> body) {
        return explorationService.updateUserExploration(requireUser(token), body);
    }

    @PostMapping("/domain-applications")
    public void applyDomain(
            @RequestHeader("satoken") String token,
            @RequestBody Map<String, Object> body) {
        explorationService.applyDomain(requireUser(token), body);
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

    private CommunityUser requireUser(String token) {
        CommunityUser user = resolveViewer(token);
        if (user == null) {
            throw new ContractException(ErrorCode.AUTH_REQUIRED);
        }
        return user;
    }
}
