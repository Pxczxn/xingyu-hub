package top.pxczxn.xingyu.system.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class SysNoticeVo {
    private Long id;
    private String title;
    private String content;
    private Integer noticeType;
    private List<String> channels;
    private Integer targetType;
    private List<Long> targetIds;
    private Integer status;
    private Long createBy;
    private String createName;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Integer isRead;
}
