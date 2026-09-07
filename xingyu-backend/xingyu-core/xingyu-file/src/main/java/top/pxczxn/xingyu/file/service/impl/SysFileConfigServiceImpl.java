package top.pxczxn.xingyu.file.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.file.entity.SysFileConfig;
import top.pxczxn.xingyu.file.mapper.SysFileConfigMapper;
import top.pxczxn.xingyu.file.service.SysFileConfigService;
import top.pxczxn.xingyu.oss.*;
import top.pxczxn.xingyu.system.storage.FileStorageFactory;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysFileConfigServiceImpl extends ServiceImpl<SysFileConfigMapper, SysFileConfig>
        implements SysFileConfigService {

    private final FileStorageFactory fileStorageFactory;

    @Override
    public PageResult<SysFileConfig> page(int page, int pageSize, String name, String storageType) {
        LambdaQueryWrapper<SysFileConfig> wrapper = new LambdaQueryWrapper<>();
        if (name != null && !name.isBlank()) {
            wrapper.like(SysFileConfig::getName, name.trim());
        }
        if (storageType != null && !storageType.isBlank()) {
            wrapper.eq(SysFileConfig::getStorageType, storageType.trim());
        }
        wrapper.orderByDesc(SysFileConfig::getMaster).orderByDesc(SysFileConfig::getId);
        Page<SysFileConfig> result = page(new Page<>(page, pageSize), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) page, (long) pageSize);
    }

    @Override
    public List<SysFileConfig> listEnabled() {
        return list(new LambdaQueryWrapper<SysFileConfig>()
                .eq(SysFileConfig::getStatus, 1)
                .orderByDesc(SysFileConfig::getMaster)
                .orderByDesc(SysFileConfig::getId));
    }

    @Override
    public SysFileConfig getMaster() {
        SysFileConfig master = baseMapper.findMaster();
        if (master == null) {
            throw new BusinessException("未配置主存储");
        }
        return master;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void create(SysFileConfig config) {
        validate(config);
        if (config.getStatus() == null) {
            config.setStatus(1);
        }
        if (config.getMaster() == null) {
            config.setMaster(0);
        }
        if (config.getMaster() == 1) {
            clearMasterFlag();
        }
        save(config);
        if (config.getMaster() == 1) {
            fileStorageFactory.refresh();
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void update(SysFileConfig config) {
        if (config.getId() == null) {
            throw new BusinessException("配置ID不能为空");
        }
        validate(config);
        if (config.getMaster() != null && config.getMaster() == 1) {
            clearMasterFlag();
        }
        updateById(config);
        if (config.getMaster() != null && config.getMaster() == 1) {
            fileStorageFactory.refresh();
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        SysFileConfig existing = getById(id);
        if (existing == null) {
            throw new BusinessException("配置不存在");
        }
        if (existing.getMaster() != null && existing.getMaster() == 1) {
            throw new BusinessException("不能删除主存储配置");
        }
        removeById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void setMaster(Long id) {
        SysFileConfig config = getById(id);
        if (config == null) {
            throw new BusinessException("配置不存在");
        }
        if (config.getStatus() == null || config.getStatus() != 1) {
            throw new BusinessException("只能将启用中的配置设为主存储");
        }
        clearMasterFlag();
        config.setMaster(1);
        updateById(config);
        fileStorageFactory.refresh();
    }

    @Override
    public boolean testConnection(SysFileConfig config) {
        validate(config);
        try {
            FileStorage storage = createStorage(config);
            return storage != null && storage.getStorageType() != null;
        } catch (Exception ex) {
            return false;
        }
    }

    private void clearMasterFlag() {
        update(new LambdaUpdateWrapper<SysFileConfig>().set(SysFileConfig::getMaster, 0));
    }

    private static void validate(SysFileConfig config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new BusinessException("配置名称不能为空");
        }
        if (config.getStorageType() == null || config.getStorageType().isBlank()) {
            throw new BusinessException("存储类型不能为空");
        }
    }

    private FileStorage createStorage(SysFileConfig config) {
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
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            case AliyunOssFileStorage.STORAGE_TYPE -> {
                AliyunOssFileStorage storage = new AliyunOssFileStorage();
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            case TencentCosFileStorage.STORAGE_TYPE -> {
                TencentCosFileStorage storage = new TencentCosFileStorage();
                storage.init(
                        config.getAccessKey(),
                        config.getSecretKey(),
                        config.getRegion(),
                        config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            case RustFsFileStorage.STORAGE_TYPE -> {
                RustFsFileStorage storage = new RustFsFileStorage();
                storage.init(
                        config.getEndpoint(),
                        config.getAccessKey(),
                        config.getSecretKey(),
                        config.getBucketName(),
                        config.getDomain());
                yield storage;
            }
            default -> throw new BusinessException("不支持的存储类型: " + type);
        };
    }
}
