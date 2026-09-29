package top.pxczxn.xingyu.web.controller;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.community.dto.FeedItemDTO;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import top.pxczxn.xingyu.community.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/feed")
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;
    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @GetMapping
    public List<FeedItemDTO> getFeed(
            @RequestHeader(value = "satoken", required = false) String token,
            @RequestParam(defaultValue = "recommended") String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return feedService.getFeed(resolveViewer(token), type, page, size);
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
