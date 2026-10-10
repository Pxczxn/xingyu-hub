package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record SavedMessageView(
        String id,
        String messageId,
        String conversationId,
        String conversationType,
        String conversationTitle,
        String messageType,
        String body,
        String attachmentUrl,
        String attachmentName,
        /**
         * 2026-10-06：附件的 {@code sys_file.id}。
         *
         * <p>之前只有 {@code attachmentUrl}，而那条地址现在被静态文件控制器拒绝
         * （社区私信附件必须过 membership 校验），于是收藏页的图片/文件全部 403。
         * 有了这个 id，收藏页就能和会话内一样走受鉴权的下载端点。
         */
        Long attachmentFileId,
        String senderId,
        Instant messageCreatedAt,
        Instant savedAt
) {}
