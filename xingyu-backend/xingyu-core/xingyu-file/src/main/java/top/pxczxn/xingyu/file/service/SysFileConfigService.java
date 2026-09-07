package top.pxczxn.xingyu.file.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.file.entity.SysFileConfig;

import java.util.List;

public interface SysFileConfigService extends IService<SysFileConfig> {

    PageResult<SysFileConfig> page(int page, int pageSize, String name, String storageType);

    List<SysFileConfig> listEnabled();

    SysFileConfig getMaster();

    void create(SysFileConfig config);

    void update(SysFileConfig config);

    void delete(Long id);

    void setMaster(Long id);

    boolean testConnection(SysFileConfig config);
}
