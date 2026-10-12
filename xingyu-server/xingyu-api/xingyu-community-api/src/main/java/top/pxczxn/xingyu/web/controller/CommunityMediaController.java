package top.pxczxn.xingyu.web.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.service.SysFileService;

/**
 * 社区媒体读取：公开资源可匿名访问；私有资源需登录且为所有者（私信附件仍走会话鉴权下载端点）。
 */
@RestController
@RequestMapping("/media")
@RequiredArgsConstructor
public class CommunityMediaController {

    private final SysFileService fileService;

    @GetMapping("/public/{fileId}")
    public ResponseEntity<byte[]> readPublic(@PathVariable long fileId) {
        SysFile file = requireFile(fileId);
        if (!"public".equalsIgnoreCase(file.getVisibility())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return stream(file);
    }

    @GetMapping("/private/{fileId}")
    public ResponseEntity<byte[]> readPrivate(@PathVariable long fileId) {
        CommunityUser user = CommunityAuthContext.requireUser();
        SysFile file = requireFile(fileId);
        if (!"private".equalsIgnoreCase(file.getVisibility())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (file.getOwnerUserId() == null || !file.getOwnerUserId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return stream(file);
    }

    private SysFile requireFile(long fileId) {
        SysFile file = fileService.getById(fileId);
        if (file == null || "deleted".equalsIgnoreCase(file.getLifecycleStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return file;
    }

    private ResponseEntity<byte[]> stream(SysFile file) {
        byte[] bytes = fileService.getFileBytes(file.getId());
        String contentType = file.getFileType() == null || file.getFileType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : file.getFileType();
        String filename = file.getOriginalName() == null ? "file" : file.getOriginalName();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + sanitize(filename) + "\"")
                .body(bytes);
    }

    private static String sanitize(String raw) {
        return raw.replaceAll("[\"\\r\\n]", "_");
    }
}
