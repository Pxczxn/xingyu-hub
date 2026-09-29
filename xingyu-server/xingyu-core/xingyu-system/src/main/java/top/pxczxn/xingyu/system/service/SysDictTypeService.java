package top.pxczxn.xingyu.system.service;

import com.baomidou.mybatisplus.extension.service.IService;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.SysDictType;

import java.util.List;

/**
 * 字典类型服务接口
 */
public interface SysDictTypeService extends IService<SysDictType> {

    /**
     * 分页查询字典类型
     */
    PageResult<SysDictType> page(Integer page, Integer pageSize, String dictName, String dictType, Integer status);

    /**
     * 获取所有字典类型
     */
    List<SysDictType> listAll();

    /**
     * 创建字典类型
     */
    void create(SysDictType dictType);

    /**
     * 更新字典类型
     */
    void update(SysDictType dictType);

    /**
     * 删除字典类型
     */
    void delete(Long id);
}
