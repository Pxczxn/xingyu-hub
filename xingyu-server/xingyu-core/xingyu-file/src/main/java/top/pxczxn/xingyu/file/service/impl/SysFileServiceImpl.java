package top.pxczxn.xingyu.file.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import top.pxczxn.xingyu.file.community.CommunityFileMediaUrls;
import top.pxczxn.xingyu.file.community.CommunityFileMediaUrls;
import top.pxczxn.xingyu.file.community.CommunityFilePathPlanner;
import top.pxczxn.xingyu.file.community.CommunityFilePurpose;
import top.pxczxn.xingyu.file.community.CommunityFileUploadCommand;
import top.pxczxn.xingyu.file.community.CommunityUploadedFileView;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.entity.SysFileConfig;
import top.pxczxn.xingyu.file.mapper.SysFileMapper;
import top.pxczxn.xingyu.file.service.SysFileService;
import top.pxczxn.xingyu.file.support.FileContentValidator;
import top.pxczxn.xingyu.file.support.StoredFileStorageService;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.oss.FileStorage;
import top.pxczxn.xingyu.system.storage.FileStorageFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.UUID;

/**
 * 文件服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SysFileServiceImpl implements SysFileService {

    private final SysFileMapper fileMapper;
    private final FileStorageFactory storageFactory;
    private final StoredFileStorageService storedFileStorageService;
    private final SystemConfigHelper configHelper;

    @Override
    public Page<SysFile> page(Integer page, Integer pageSize, String originalName, String fileType) {
        Page<SysFile> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<SysFile> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(originalName)) {
            wrapper.like(SysFile::getOriginalName, originalName);
        }
        if (StringUtils.hasText(fileType)) {
            wrapper.like(SysFile::getFileType, fileType);
        }

        wrapper.orderByDesc(SysFile::getCreateTime);
        return fileMapper.selectPage(pageParam, wrapper);
    }

    @Override
    public Page<SysFile> pageByGroup(Integer page, Integer pageSize, Long groupId, String fileCategory, String originalName) {
        Page<SysFile> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<SysFile> wrapper = new LambdaQueryWrapper<>();

        // 分组过滤：-1表示全部，null表示未分组，其他表示指定分组
        if (groupId != null && groupId != -1) {
            wrapper.eq(SysFile::getGroupId, groupId);
        } else if (groupId == null) {
            wrapper.isNull(SysFile::getGroupId);
        }
        // groupId == -1 时不添加分组条件，查询全部

        // 文件类别过滤
        if (StringUtils.hasText(fileCategory)) {
            switch (fileCategory) {
                case "image" -> wrapper.likeRight(SysFile::getFileType, "image/");
                case "video" -> wrapper.likeRight(SysFile::getFileType, "video/");
                case "audio" -> wrapper.likeRight(SysFile::getFileType, "audio/");
                case "other" -> wrapper.and(w -> w
                        .notLike(SysFile::getFileType, "image/")
                        .notLike(SysFile::getFileType, "video/")
                        .notLike(SysFile::getFileType, "audio/"));
            }
        }

        // 文件名搜索
        if (StringUtils.hasText(originalName)) {
            wrapper.like(SysFile::getOriginalName, originalName);
        }

        wrapper.orderByDesc(SysFile::getCreateTime);
        return fileMapper.selectPage(pageParam, wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysFile upload(MultipartFile file, String path) {
        return upload(file, path, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysFile upload(MultipartFile file, String path, Long groupId) {
        return upload(file, path, groupId, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysFile upload(MultipartFile file, String path, Long groupId, String createBy) {
        // 验证文件大小
        configHelper.validateFileSize(file.getSize());

        // 验证文件类型
        String originalName = file.getOriginalFilename();
        if (originalName != null) {
            configHelper.validateFileType(originalName);
        }

        FileStorage storage = storedFileStorageService.getMasterStorage(true);
        String suffix = getFileSuffix(originalName);
        String fileName = generateFileName(suffix);

        // 生成存储路径
        String storagePath = StringUtils.hasText(path) ? path : generatePath();

        try {
            // 上传文件
            String url = storage.upload(file.getInputStream(), storagePath, fileName);

            // 保存文件记录
            SysFile sysFile = new SysFile();
            sysFile.setOriginalName(originalName);
            sysFile.setFileName(fileName);
            sysFile.setFilePath(storagePath + "/" + fileName);
            sysFile.setUrl(url);
            sysFile.setFileSize(file.getSize());
            sysFile.setFileType(file.getContentType());
            sysFile.setFileSuffix(suffix);
            sysFile.setStorageType(storage.getStorageType());
            sysFile.setGroupId(groupId);
            sysFile.setCreateBy(resolveCreateBy(createBy));
            sysFile.setCreateTime(LocalDateTime.now());

            fileMapper.insert(sysFile);

            log.info("文件上传成功: {} -> {}", originalName, url);
            return sysFile;
        } catch (IOException e) {
            log.error("文件上传失败", e);
            throw new RuntimeException("文件上传失败", e);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysFile uploadImage(MultipartFile file) {
        // 验证是否为图片
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("请上传图片文件");
        }

        // 上传到 images 目录
        return upload(file, "images/" + generatePath());
    }

    @Override
    public SysFile getById(Long id) {
        return fileMapper.selectById(id);
    }

    @Override
    public byte[] getFileBytes(Long id) {
        SysFile sysFile = fileMapper.selectById(id);
        if (sysFile == null) {
            throw new RuntimeException("文件不存在");
        }

        FileStorage storage = storedFileStorageService.getStorageForFile(sysFile);
        return storage.getFile(sysFile.getFilePath());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CommunityUploadedFileView uploadCommunity(MultipartFile file, CommunityFileUploadCommand command) {
        CommunityFilePurpose purpose = command.getPurpose();
        boolean publicZone = purpose.isPublicByDefault();
        long maxBytes = storedFileStorageService.maxUploadBytes();
        if (purpose == CommunityFilePurpose.MESSAGE_ATTACHMENT) {
            FileContentValidator.validateAttachmentUpload(
                    file,
                    java.util.Set.of(
                            "jpg", "jpeg", "png", "gif", "webp",
                            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
                            "txt", "md", "csv", "zip"),
                    maxBytes);
        } else {
            FileContentValidator.validateImageUpload(file, maxBytes);
        }

        String suffix = FileContentValidator.requireExtension(file.getOriginalFilename());
        String objectKey = CommunityFilePathPlanner.objectKey(
                purpose,
                command.getOwnerUserId(),
                "." + suffix,
                command.getDraftId(),
                command.getArticleId(),
                command.getSeriesId(),
                command.getGalaxyId(),
                command.getMomentId());

        SysFileConfig master = storedFileStorageService.getMasterConfig();
        FileStorage storage = storedFileStorageService.getMasterStorage(publicZone);
        String fileName = objectKey.substring(objectKey.lastIndexOf('/') + 1);
        String storagePath = objectKey.substring(0, objectKey.lastIndexOf('/'));

        try {
            storage.upload(file.getInputStream(), storagePath, fileName);
            SysFile sysFile = new SysFile();
            sysFile.setOriginalName(file.getOriginalFilename());
            sysFile.setFileName(fileName);
            sysFile.setFilePath(storagePath + "/" + fileName);
            sysFile.setUrl("");
            sysFile.setFileSize(file.getSize());
            sysFile.setFileType(file.getContentType());
            sysFile.setFileSuffix("." + suffix);
            sysFile.setStorageType(storage.getStorageType());
            if (master != null) {
                sysFile.setFileConfigId(master.getId());
                sysFile.setBucketName(
                        storedFileStorageService.resolveBucketName(master, publicZone, null));
            }
            sysFile.setFilePurpose(purpose.name());
            sysFile.setVisibility(publicZone ? "public" : "private");
            sysFile.setOwnerUserId(command.getOwnerUserId());
            sysFile.setLifecycleStatus("active");
            sysFile.setCreateBy(command.getOwnerUserId());
            sysFile.setCreateTime(LocalDateTime.now());
            fileMapper.insert(sysFile);
            if (publicZone) {
                sysFile.setUrl(publicMediaUrl(sysFile.getId()));
                fileMapper.updateById(sysFile);
            } else {
                sysFile.setUrl("/api/v1/media/private/" + sysFile.getId());
                fileMapper.updateById(sysFile);
            }
            return CommunityUploadedFileView.builder()
                    .fileId(sysFile.getId())
                    .url(sysFile.getUrl())
                    .name(sysFile.getOriginalName() == null ? fileName : sysFile.getOriginalName())
                    .mimeType(sysFile.getFileType() == null ? "" : sysFile.getFileType())
                    .visibility(sysFile.getVisibility())
                    .purpose(purpose.name())
                    .build();
        } catch (IOException e) {
            log.error("社区文件上传失败", e);
            throw new RuntimeException("文件上传失败", e);
        }
    }

    @Override
    public String publicMediaUrl(long fileId) {
        return "/api/v1/media/public/" + fileId;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void promoteCommunityFileToPublic(long fileId, String expectedOwnerUserId) {
        SysFile sysFile = fileMapper.selectById(fileId);
        if (sysFile == null || "deleted".equalsIgnoreCase(sysFile.getLifecycleStatus())) {
            return;
        }
        if ("public".equalsIgnoreCase(sysFile.getVisibility())) {
            return;
        }
        if (expectedOwnerUserId == null
                || sysFile.getOwnerUserId() == null
                || !expectedOwnerUserId.equals(sysFile.getOwnerUserId())) {
            throw new RuntimeException("无权发布该媒体文件");
        }
        sysFile.setVisibility("public");
        sysFile.setUrl(publicMediaUrl(fileId));
        fileMapper.updateById(sysFile);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String promotePrivateMediaInText(String text, String expectedOwnerUserId) {
        if (text == null || text.isBlank()) {
            return text;
        }
        for (Long fileId : CommunityFileMediaUrls.extractPrivateFileIds(text)) {
            promoteCommunityFileToPublic(fileId, expectedOwnerUserId);
        }
        return CommunityFileMediaUrls.replacePrivateWithPublic(text);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String promotePrivateMediaUrl(String url, String expectedOwnerUserId) {
        if (url == null || url.isBlank()) {
            return url;
        }
        Long fileId = CommunityFileMediaUrls.extractSinglePrivateFileId(url);
        if (fileId == null) {
            return url;
        }
        promoteCommunityFileToPublic(fileId, expectedOwnerUserId);
        return publicMediaUrl(fileId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        SysFile sysFile = fileMapper.selectById(id);
        if (sysFile == null) {
            return;
        }

        // 删除存储文件
        try {
            FileStorage storage = storedFileStorageService.getStorageForFile(sysFile);
            storage.delete(sysFile.getFilePath());
        } catch (Exception e) {
            log.error("删除存储文件失败", e);
        }

        // 删除记录
        fileMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteBatch(Long[] ids) {
        Arrays.stream(ids).forEach(this::delete);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveToGroup(Long[] fileIds, Long groupId) {
        if (fileIds == null || fileIds.length == 0) {
            return;
        }
        fileMapper.update(null, new LambdaUpdateWrapper<SysFile>()
                .in(SysFile::getId, Arrays.asList(fileIds))
                .set(SysFile::getGroupId, groupId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void rename(Long id, String newName) {
        SysFile file = fileMapper.selectById(id);
        if (file == null) {
            throw new RuntimeException("文件不存在");
        }
        file.setOriginalName(newName);
        fileMapper.updateById(file);
    }

    private String resolveCreateBy(String explicitCreateBy) {
        if (StringUtils.hasText(explicitCreateBy)) {
            return explicitCreateBy;
        }
        try {
            if (StpUtil.isLogin()) {
                return StpUtil.getLoginIdAsString();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /**
     * 获取文件后缀
     */
    private String getFileSuffix(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf("."));
    }

    /**
     * 生成文件名
     */
    private String generateFileName(String suffix) {
        return UUID.randomUUID().toString().replace("-", "") + suffix;
    }

    /**
     * 生成存储路径（按日期）
     */
    private String generatePath() {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
    }
}
