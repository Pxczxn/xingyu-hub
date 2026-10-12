package top.pxczxn.xingyu.web.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.file.community.CommunityFilePurpose;
import top.pxczxn.xingyu.file.community.CommunityFileUploadCommand;
import top.pxczxn.xingyu.file.community.CommunityUploadedFileView;
import top.pxczxn.xingyu.file.service.SysFileService;

/**
 * 社区统一文件上传（按 purpose 区分权限与存储路径）。
 */
@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class CommunityFileController {

    private final SysFileService fileService;
    private final ArticleMapper articleMapper;

    @PostMapping("/upload")
    public CommunityUploadedFileView upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("purpose") String purpose,
            @RequestParam(value = "draftId", required = false) String draftId,
            @RequestParam(value = "articleId", required = false) String articleId,
            @RequestParam(value = "seriesId", required = false) String seriesId,
            @RequestParam(value = "galaxyId", required = false) String galaxyId,
            @RequestParam(value = "momentId", required = false) String momentId) {
        CommunityFilePurpose parsed;
        try {
            parsed = CommunityFilePurpose.parse(purpose);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知的 purpose");
        }
        String ownerUserId = CommunityAuthContext.requireUser().getId();
        assertPurposeAllowed(parsed, ownerUserId, articleId);
        return fileService.uploadCommunity(
                file,
                CommunityFileUploadCommand.builder()
                        .purpose(parsed)
                        .ownerUserId(ownerUserId)
                        .draftId(draftId)
                        .articleId(articleId)
                        .seriesId(seriesId)
                        .galaxyId(galaxyId)
                        .momentId(momentId)
                        .build());
    }

    private void assertPurposeAllowed(CommunityFilePurpose purpose, String ownerUserId, String articleId) {
        if (ownerUserId == null || ownerUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "需要登录");
        }
        if (purpose != CommunityFilePurpose.ARTICLE_COVER && purpose != CommunityFilePurpose.ARTICLE_BODY_IMAGE) {
            return;
        }
        if (articleId == null || articleId.isBlank()) {
            return;
        }
        Article article = articleMapper.selectById(articleId);
        if (article == null || article.getOwnerId() == null || !article.getOwnerId().equals(ownerUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权向该文章上传资源");
        }
    }
}
