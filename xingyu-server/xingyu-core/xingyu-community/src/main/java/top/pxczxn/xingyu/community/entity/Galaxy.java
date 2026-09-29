package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("galaxy")
public class Galaxy {
    @TableId
    private String id;
    private String seedKey;
    private String slug;
    private String name;
    private Boolean official;
    private String joinMode;
}
