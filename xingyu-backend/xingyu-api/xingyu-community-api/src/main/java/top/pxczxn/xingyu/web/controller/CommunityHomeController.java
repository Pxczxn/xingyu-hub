package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.dto.MeHomeView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.HomeCompositionView;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CommunityHomeController {

    private final HomeService homeService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping("/home")
    public HomeCompositionView home(@RequestHeader(value = "satoken", required = false) String token) {
        return homeService.compose(resolveViewer(token));
    }

    @GetMapping("/me/home")
    public MeHomeView meHome(@RequestHeader(value = "satoken", required = false) String token) {
        return homeService.composeForMe(resolveViewer(token));
    }

    @GetMapping("/discover")
    public PageResultView<ContentCardView> discover(
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "cursor", required = false) String cursor) {
        return homeService.discover(limit, cursor);
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
