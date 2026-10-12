package top.pxczxn.xingyu.file.support;

import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

/**
 * 服务端上传校验：扩展名 + 拒绝 SVG/HTML + 图片魔数/解码。
 */
public final class FileContentValidator {

    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp");

    private FileContentValidator() {}

    public static void validateImageUpload(MultipartFile file, long maxBytes) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择要上传的文件");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件大小超过限制");
        }
        String extension = requireExtension(file.getOriginalFilename());
        if (!IMAGE_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的图片格式");
        }
        if ("svg".equals(extension) || "html".equals(extension) || "htm".equals(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不允许上传该类型文件");
        }
        try (InputStream in = file.getInputStream()) {
            BufferedImage image = ImageIO.read(in);
            if (image == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法识别的图片内容");
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片读取失败");
        }
    }

    public static void validateAttachmentUpload(MultipartFile file, Set<String> allowedExtensions, long maxBytes) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择要上传的文件");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件大小超过限制");
        }
        String extension = requireExtension(file.getOriginalFilename());
        if (!allowedExtensions.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该附件类型不允许上传");
        }
        if ("svg".equals(extension) || "html".equals(extension) || "htm".equals(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不允许上传该类型文件");
        }
    }

    public static String requireExtension(String filename) {
        if (!StringUtils.hasText(filename) || !filename.contains(".")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件名必须包含允许的扩展名");
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }
}
