package top.pxczxn.xingyu.file.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.file.entity.SysFileConfig;

@Mapper
public interface SysFileConfigMapper extends BaseMapper<SysFileConfig> {

    @Select("SELECT * FROM sys_file_config WHERE master = 1 AND status = 1 LIMIT 1")
    SysFileConfig findMaster();
}
