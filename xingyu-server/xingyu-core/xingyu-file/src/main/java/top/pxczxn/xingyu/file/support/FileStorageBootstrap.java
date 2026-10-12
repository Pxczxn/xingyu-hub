package top.pxczxn.xingyu.file.support;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.file.entity.SysFileConfig;
import top.pxczxn.xingyu.oss.*;

/**
 * 从 {@link SysFileConfig} 构造 {@link FileStorage} 实例（与主配置切换解耦，按文件记录定位历史存储）。
 */
@Component
public class FileStorageBootstrap {

    public FileStorage create(SysFileConfig config) {
        return create(config, config.getBucketName());
    }

    public FileStorage create(SysFileConfig config, String bucketName) {
        if (config == null) {
            throw new BusinessException("文件存储配置不存在");
        }
        String type = config.getStorageType().trim().toLowerCase();
        return switch (type) {
            case LocalFileStorage.STORAGE_TYPE -> {
                LocalFileStorage storage = new LocalFileStorage();
                storage.init(
                        config.getBasePath() == null ? "runtime/uploads" : config.getBasePath(),
                        config.getDomain() == null ? "" : config.getDomain());
                yield storage;
            }
            case MinioFileStorage.STORAGE_TYPE -> {
                MinioFileStorage storage = new MinioFileStorage();
                String bucket = StringUtils.hasText(bucketName) ? bucketName : config.getBucketName();
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        bucket,
                        config.getDomain());
                yield storage;
            }
            case AliyunOssFileStorage.STORAGE_TYPE -> {
                AliyunOssFileStorage storage = new AliyunOssFileStorage();
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        StringUtils.hasText(bucketName) ? bucketName : config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            case TencentCosFileStorage.STORAGE_TYPE -> {
                TencentCosFileStorage storage = new TencentCosFileStorage();
                storage.init(
                        config.getAccessKey(),
                        config.getSecretKey(),
                        config.getRegion(),
                        StringUtils.hasText(bucketName) ? bucketName : config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            case RustFsFileStorage.STORAGE_TYPE -> {
                RustFsFileStorage storage = new RustFsFileStorage();
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        StringUtils.hasText(bucketName) ? bucketName : config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            default -> throw new BusinessException("不支持的存储类型: " + type);
        };
    }
}
