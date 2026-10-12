package top.pxczxn.xingyu.file.community;

/**
 * 社区侧文件用途。Object Key 由服务端按用途生成，客户端不可指定路径。
 */
public enum CommunityFilePurpose {
    USER_AVATAR,
    USER_BANNER,
    ARTICLE_COVER,
    ARTICLE_BODY_IMAGE,
    SERIES_COVER,
    GALAXY_COVER,
    MOMENT_MEDIA,
    MESSAGE_ATTACHMENT,
    DRAFT_IMAGE,
    DRAFT_ATTACHMENT,
    TEMP_UPLOAD;

    public static CommunityFilePurpose parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("purpose 不能为空");
        }
        return CommunityFilePurpose.valueOf(raw.trim().toUpperCase());
    }

    public boolean isPublicByDefault() {
        return switch (this) {
            case USER_AVATAR, USER_BANNER, SERIES_COVER, GALAXY_COVER, MOMENT_MEDIA -> true;
            case ARTICLE_COVER, ARTICLE_BODY_IMAGE, MESSAGE_ATTACHMENT, DRAFT_IMAGE, DRAFT_ATTACHMENT, TEMP_UPLOAD ->
                    false;
        };
    }
}
