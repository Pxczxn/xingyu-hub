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
    /** 星系简介（V051）。SchemaMigrator 启动即执行 pending 迁移，列必然先于请求存在。 */
    private String description;
    /** 星系封面 URL（V051）；null 时前端回退确定性装饰图。 */
    private String coverUrl;
    private String joinMode;
}
