package top.pxczxn.xingyu.admin.controller.file;

import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 本地文件访问控制器
 *
 * <p>⚠️ 2026-10-06：这里<b>不做会话校验</b>，任何知道路径的人都能取到文件。社区私信附件
 * 曾直接落在可服务范围内（{@code /api/v1/admin/files/community/messages/<hash>}），
 * 实测不带 token 返回 200 —— 也就是说「路径难猜」是私信附件的唯一屏障。
 *
 * <p>现在该前缀被显式拒绝：私信附件只能经
 * {@code GET /api/v1/messages/{conversationId}/messages/{messageId}/attachment} 取得，
 * 那条路径先校验 conversation membership。所以「猜 URL / 拿到 URL 的非成员都下载不到」。
 *
 * <p>注意：<b>其它</b>上传类别（头像、文章封面等）仍走这条无鉴权静态路径 —— 那是全项目
 * 范围内的既有状况，不在本次私信修复范围内，不要因为这一处被拒绝就以为整体已经收口。
 */
@Slf4j
@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileAccessController {

    /**
     * 必须拒绝静态直出的目录前缀。社区私信附件属于私密内容，访问权由 conversation
     * membership 决定，不能靠 URL 不可猜。
     */
    private static final String[] MEMBER_ONLY_PREFIXES = {
        "community/messages/",
    };

    private final SystemConfigHelper configHelper;

    /**
     * 访问本地文件
     */
    @GetMapping("/**")
    public ResponseEntity<byte[]> getFile(HttpServletRequest request) {
        // 获取文件路径
        // ApiPrefixConfig 给 admin 包下的控制器加了 /api/v1/admin 前缀
        // 实际请求 URI 形如 /api/v1/admin/files/xxx
        String requestUri = request.getRequestURI();
        int filesIndex = requestUri.indexOf("/files/");
        String filePath = (filesIndex >= 0) ? requestUri.substring(filesIndex + "/files".length()) : requestUri;

        for (String prefix : MEMBER_ONLY_PREFIXES) {
            // `filePath` keeps the leading slash (`/community/messages/…`) because it is
            // sliced off right after "/files", so normalise before comparing — otherwise
            // `startsWith("community/messages/")` never matches and the guard is a no-op.
            String relative = filePath.startsWith("/") ? filePath.substring(1) : filePath;
            if (relative.replace('\\', '/').startsWith(prefix)) {
                log.warn("拒绝静态访问受限目录: {}", relative);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        // 获取本地存储路径
        String basePath = configHelper.getStorageLocalPath();

        try {
            // 构建完整路径
            Path fullPath = Paths.get(basePath, filePath);

            // 安全检查：确保路径在基础目录内
            if (!fullPath.normalize().startsWith(Paths.get(basePath).normalize())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            if (!Files.exists(fullPath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            // 读取文件
            byte[] bytes = Files.readAllBytes(fullPath);
            String contentType = Files.probeContentType(fullPath);
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .body(bytes);
        } catch (IOException e) {
            log.error("读取文件失败: {}", filePath, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
