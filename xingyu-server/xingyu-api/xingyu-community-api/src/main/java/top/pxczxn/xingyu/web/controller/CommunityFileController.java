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
        assertPurposeAllowed(parsed, ownerUserId);
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

    private static void assertPurposeAllowed(CommunityFilePurpose purpose, String ownerUserId) {
        if (ownerUserId == null || ownerUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "需要登录");
        }
        // 细粒度归属校验（文章/系列是否属于当前用户）在业务保存阶段完成；上传阶段仅校验登录与 purpose 枚举。
    }
}
