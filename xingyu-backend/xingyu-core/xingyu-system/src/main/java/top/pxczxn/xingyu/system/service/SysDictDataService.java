package top.pxczxn.xingyu.system.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.SysDictData;

import java.util.List;

/**
 * 字典数据服务接口
 */
public interface SysDictDataService extends IService<SysDictData> {

    /**
     * 分页查询字典数据
     */
    PageResult<SysDictData> page(Integer page, Integer pageSize, String dictType, String dictLabel, Integer status);

    /**
     * 根据字典类型查询字典数据
     */
    List<SysDictData> listByDictType(String dictType);

    /**
     * 创建字典数据
     */
    void create(SysDictData dictData);

    /**
     * 更新字典数据
     */
    void update(SysDictData dictData);

    /**
     * 删除字典数据
     */
    void delete(Long id);
}
