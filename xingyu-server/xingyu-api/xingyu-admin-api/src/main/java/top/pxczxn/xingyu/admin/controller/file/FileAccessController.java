package top.pxczxn.xingyu.admin.controller.file;

import top.pxczxn.xingyu.oss.StoragePathException;
import top.pxczxn.xingyu.oss.StoragePaths;
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

/**
 * 本地文件访问控制器
 *
 * <p>登录和 admin 角色由 {@code SaTokenConfig} 统一校验。公开头像、封面走
 * {@code /api/v1/media/public/**}，不经过这里。
 *
 * <p>{@code private/} 与 {@code community/messages/} 即使管理员也不能从这条静态路径读取，
 * 私信附件仍走带会话成员校验的下载接口。
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
        "private/",
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
        String relative = filePath.replace('\\', '/');
        while (relative.startsWith("/")) {
            relative = relative.substring(1);
        }

        for (String prefix : MEMBER_ONLY_PREFIXES) {
            if (relative.startsWith(prefix)) {
                log.warn("拒绝静态访问受限目录");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        String basePath = configHelper.getStorageLocalPath();

        try {
            Path fullPath = StoragePaths.resolveInsideRoot(basePath, relative);

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
        } catch (StoragePathException e) {
            log.warn("拒绝非法文件路径");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IOException e) {
            log.error("读取文件失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
