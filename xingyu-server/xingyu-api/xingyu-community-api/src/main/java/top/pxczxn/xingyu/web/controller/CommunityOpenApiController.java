package top.pxczxn.xingyu.web.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import top.pxczxn.xingyu.community.context.CommunityOpenApiContext;
import top.pxczxn.xingyu.community.dto.ArticleSummaryView;
import top.pxczxn.xingyu.community.dto.ProfileView;
import top.pxczxn.xingyu.community.entity.CommunityApiToken;
import top.pxczxn.xingyu.community.service.ArticleService;
import top.pxczxn.xingyu.community.service.CommunityApiTokenService;
import top.pxczxn.xingyu.community.service.CommunityProfileService;

import java.util.List;

@RestController
@RequestMapping("/open")
@RequiredArgsConstructor
public class CommunityOpenApiController {

    private final CommunityApiTokenService apiTokenService;
    private final CommunityProfileService profileService;
    private final ArticleService articleService;

    @GetMapping("/profile")
    public ProfileView profile() {
        CommunityApiToken token = CommunityOpenApiContext.requireToken();
        apiTokenService.requireScope(token, "read:profile");
        return profileService.getProfile(CommunityOpenApiContext.requireUser());
    }

    @GetMapping("/articles")
    public List<ArticleSummaryView> articles() {
        CommunityApiToken token = CommunityOpenApiContext.requireToken();
        apiTokenService.requireScope(token, "read:articles");
        return articleService.listForOwner(CommunityOpenApiContext.requireUser());
    }
}
