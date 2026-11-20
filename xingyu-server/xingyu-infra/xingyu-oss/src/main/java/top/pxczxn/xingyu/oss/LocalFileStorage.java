package top.pxczxn.xingyu.oss;

import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * 本地文件存储
 */
@Slf4j
public class LocalFileStorage implements FileStorage {

    public static final String STORAGE_TYPE = "local";

    private String basePath;

    @Override
    public String getStorageType() {
        return STORAGE_TYPE;
    }

    /**
     * 初始化配置
     */
    public void init(String basePath, String domain) {
        this.basePath = basePath;

        // 确保基础目录存在
        try {
            Path path = Paths.get(basePath);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
            log.info("本地存储初始化完成, 路径: {}", basePath);
        } catch (IOException e) {
            log.error("创建本地存储目录失败: {}", basePath, e);
        }
    }

    @Override
    public String upload(InputStream inputStream, String path, String fileName) {
        try {
            Path fullPath = StoragePaths.resolveInsideRoot(basePath, path, fileName);
            Files.createDirectories(fullPath.getParent());
            fullPath = StoragePaths.resolveInsideRoot(basePath, path, fileName);
            Files.copy(inputStream, fullPath, StandardCopyOption.REPLACE_EXISTING);
            return getUrl(path + "/" + fileName);
        } catch (StoragePathException e) {
            throw e;
        } catch (IOException e) {
            log.error("本地文件上传失败", e);
            throw new RuntimeException("文件上传失败");
        }
    }

    @Override
    public void delete(String path) {
        try {
            Path fullPath = StoragePaths.resolveInsideRoot(basePath, path);
            Files.deleteIfExists(fullPath);
        } catch (StoragePathException e) {
            throw e;
        } catch (IOException e) {
            log.error("本地文件删除失败", e);
        }
    }

    @Override
    public byte[] getFile(String path) {
        try {
            Path fullPath = StoragePaths.resolveInsideRoot(basePath, path);
            return Files.readAllBytes(fullPath);
        } catch (StoragePathException e) {
            throw e;
        } catch (IOException e) {
            log.error("本地文件读取失败", e);
            throw new RuntimeException("文件读取失败");
        }
    }

    @Override
    public String getUrl(String path) {
        String normalizedPath = "/" + StoragePaths.normalizeRelative(path);
        // 本地存储使用相对路径，由 FileAccessController 提供访问。
        // ApiPrefixConfig 给 admin 包下的 @RestController 加 /api/v1/admin 前缀。
        return "/api/v1/admin/files" + normalizedPath;
    }

    @Override
    public boolean exists(String path) {
        Path fullPath = StoragePaths.resolveInsideRoot(basePath, path);
        return Files.exists(fullPath);
    }

    /**
     * 获取文件的完整本地路径
     */
    public Path getFullPath(String path) {
        return StoragePaths.resolveInsideRoot(basePath, path);
    }

    /**
     * 获取基础路径
     */
    public String getBasePath() {
        return basePath;
    }
}
