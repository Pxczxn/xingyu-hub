package top.pxczxn.xingyu.file.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_file_config")
public class SysFileConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String storageType;

    /** 0/1 */
    private Integer master;

    private String domain;

    private String basePath;

    private String bucketName;

    private String accessKey;

    private String secretKey;

    private String endpoint;

    private String region;

    private Integer status;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
