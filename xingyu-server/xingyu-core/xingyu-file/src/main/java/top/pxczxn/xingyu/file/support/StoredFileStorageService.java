package top.pxczxn.xingyu.file.support;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.entity.SysFileConfig;
import top.pxczxn.xingyu.file.mapper.SysFileConfigMapper;
import top.pxczxn.xingyu.oss.FileStorage;
import top.pxczxn.xingyu.oss.MinioFileStorage;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.storage.FileStorageFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 按 {@link SysFileConfig} / 文件记录解析存储实例。主配置以 {@code sys_file_config.master=1} 为准，
 * 无记录时回退 {@link FileStorageFactory}（sys_config_group.storage）。
 */
@Service
@RequiredArgsConstructor
public class StoredFileStorageService {

    private static final String DEFAULT_PUBLIC_BUCKET = "xingyu-public";
    private static final String DEFAULT_PRIVATE_BUCKET = "xingyu-private";

    private final SysFileConfigMapper fileConfigMapper;
    private final FileStorageBootstrap bootstrap;
    private final FileStorageFactory legacyStorageFactory;
    private final SystemConfigHelper configHelper;

    private final Map<String, FileStorage> cache = new ConcurrentHashMap<>();

    public void refresh() {
        cache.clear();
    }

    public SysFileConfig getMasterConfig() {
        return fileConfigMapper.findMaster();
    }

    public FileStorage getMasterStorage(boolean publicZone) {
        SysFileConfig master = getMasterConfig();
        if (master != null) {
            return getStorageForConfig(master, publicZone);
        }
        return legacyStorageFactory.getStorage();
    }

    public FileStorage getStorageForFile(SysFile file) {
        if (file == null) {
            throw new IllegalArgumentException("file is null");
        }
        if (file.getFileConfigId() != null) {
            SysFileConfig config = fileConfigMapper.selectById(file.getFileConfigId());
            if (config != null) {
                boolean publicZone = "public".equalsIgnoreCase(file.getVisibility());
                String bucket = resolveBucketName(config, publicZone, file.getBucketName());
                return cached(config.getId(), bucket, () -> bootstrap.create(config, bucket));
            }
        }
        // 历史记录：仅有 storageType，走当前同类型主配置或 legacy
        SysFileConfig master = getMasterConfig();
        if (master != null && file.getStorageType() != null
                && file.getStorageType().equalsIgnoreCase(master.getStorageType())) {
            boolean publicZone = file.getVisibility() == null || "public".equalsIgnoreCase(file.getVisibility());
            String bucket = resolveBucketName(master, publicZone, file.getBucketName());
            return cached(master.getId(), bucket, () -> bootstrap.create(master, bucket));
        }
        return legacyStorageFactory.getStorage();
    }

    public String resolveBucketName(SysFileConfig config, boolean publicZone, String fileBucketHint) {
        if (StringUtils.hasText(fileBucketHint)) {
            return fileBucketHint;
        }
        if (MinioFileStorage.STORAGE_TYPE.equalsIgnoreCase(config.getStorageType())) {
            if (publicZone && StringUtils.hasText(config.getPublicBucketName())) {
                return config.getPublicBucketName();
            }
            if (!publicZone && StringUtils.hasText(config.getPrivateBucketName())) {
                return config.getPrivateBucketName();
            }
            return publicZone ? DEFAULT_PUBLIC_BUCKET : DEFAULT_PRIVATE_BUCKET;
        }
        return config.getBucketName();
    }

    public FileStorage getStorageForConfig(SysFileConfig config, boolean publicZone) {
        String bucket = resolveBucketName(config, publicZone, null);
        return cached(config.getId(), bucket, () -> bootstrap.create(config, bucket));
    }

    public long maxUploadBytes() {
        return (long) configHelper.getStorageMaxSize() * 1024L * 1024L;
    }

    private FileStorage cached(Long configId, String bucket, java.util.function.Supplier<FileStorage> factory) {
        String key = configId + ":" + (bucket == null ? "" : bucket);
        return cache.computeIfAbsent(key, ignored -> factory.get());
    }
}
