package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("chat_message")
public class ChatMessage {
    @TableId
    private String id;
    private String conversationId;
    private String senderId;
    private Long sequenceNumber;
    private String body;
    private String messageType;
    private String attachmentUrl;
    private String attachmentName;
    /**
     * 附件对应的 {@code sys_file.id}（V045）。
     *
     * <p>与 {@code attachmentUrl} 并存但用途不同：URL 是展示地址（历史无鉴权），
     * 这个 id 让下载端点可以用 {@code SysFileService.getFileBytes} 读字节，
     * 从而在吐字节之前先校验 conversation membership。
     */
    private Long attachmentFileId;
    private String clientMessageId;
    private Instant createdAt;
    private Instant recalledAt;
}
