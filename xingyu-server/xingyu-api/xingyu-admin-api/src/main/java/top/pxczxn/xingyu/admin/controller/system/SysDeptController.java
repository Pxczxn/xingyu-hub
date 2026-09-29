package top.pxczxn.xingyu.admin.controller.system;

import cn.dev33.satoken.annotation.SaCheckPermission;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.annotation.Log;
import top.pxczxn.xingyu.system.annotation.RepeatSubmit;
import top.pxczxn.xingyu.system.annotation.Log.BusinessType;
import top.pxczxn.xingyu.system.entity.SysDept;
import top.pxczxn.xingyu.system.service.SysDeptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 部门管理控制器
 */
@RestController
@RequestMapping("/sys/dept")
@RequiredArgsConstructor
public class SysDeptController {

    private final SysDeptService deptService;

    /**
     * 获取部门树
     */
    @GetMapping("/tree")
    @SaCheckPermission("sys:dept:list")
    public Result<List<SysDept>> tree(
            @RequestParam(required = false) String deptName,
            @RequestParam(required = false) Integer status) {
        return Result.ok(deptService.tree(deptName, status));
    }

    /**
     * 获取部门列表
     */
    @GetMapping("/list")
    public Result<List<SysDept>> list() {
        return Result.ok(deptService.listAll());
    }

    /**
     * 获取详情
     */
    @GetMapping("/{id}")
    @SaCheckPermission("sys:dept:list")
    public Result<SysDept> detail(@PathVariable Long id) {
        return Result.ok(deptService.getById(id));
    }

    /**
     * 创建
     */
    @PostMapping
    @SaCheckPermission("sys:dept:add")
    @RepeatSubmit
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    public Result<Void> create(@RequestBody SysDept dept) {
        deptService.create(dept);
        return Result.ok();
    }

    /**
     * 更新
     */
    @PutMapping
    @SaCheckPermission("sys:dept:edit")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    public Result<Void> update(@RequestBody SysDept dept) {
        deptService.update(dept);
        return Result.ok();
    }

    /**
     * 删除
     */
    @DeleteMapping("/{id}")
    @SaCheckPermission("sys:dept:delete")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        deptService.delete(id);
        return Result.ok();
    }

    /**
     * 移动部门（拖拽修改层级和排序）
     */
    @PutMapping("/move")
    @SaCheckPermission("sys:dept:edit")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    public Result<Void> move(@RequestParam Long id, @RequestParam Long parentId, @RequestParam(required = false) Integer sort) {
        deptService.move(id, parentId, sort);
        return Result.ok();
    }
}
