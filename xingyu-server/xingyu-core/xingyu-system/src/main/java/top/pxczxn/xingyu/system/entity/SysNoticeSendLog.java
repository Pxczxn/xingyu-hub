package top.pxczxn.xingyu.system.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_notice_send_log")
public class SysNoticeSendLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long noticeId;
    private String channel;
    private Integer status;
    private Integer targetCount;
    private Integer successCount;
    private String errorMsg;
    private LocalDateTime sendTime;
}
