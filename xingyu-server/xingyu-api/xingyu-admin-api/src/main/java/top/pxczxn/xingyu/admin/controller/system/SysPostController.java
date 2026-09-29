package top.pxczxn.xingyu.admin.controller.system;

import cn.dev33.satoken.annotation.SaCheckPermission;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.annotation.Log;
import top.pxczxn.xingyu.system.annotation.RepeatSubmit;
import top.pxczxn.xingyu.system.annotation.Log.BusinessType;
import top.pxczxn.xingyu.system.entity.SysPost;
import top.pxczxn.xingyu.system.service.SysPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 岗位管理控制器
 */
@RestController
@RequestMapping("/sys/post")
@RequiredArgsConstructor
public class SysPostController {

    private final SysPostService postService;

    /**
     * 分页查询
     */
    @GetMapping("/page")
    @SaCheckPermission("sys:post:list")
    public Result<PageResult<SysPost>> page(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String postCode,
            @RequestParam(required = false) String postName,
            @RequestParam(required = false) Integer status) {
        return Result.ok(postService.page(page, pageSize, postCode, postName, status));
    }

    /**
     * 获取所有岗位
     */
    @GetMapping("/list")
    public Result<List<SysPost>> list() {
        return Result.ok(postService.listAll());
    }

    /**
     * 获取详情
     */
    @GetMapping("/{id}")
    @SaCheckPermission("sys:post:list")
    public Result<SysPost> detail(@PathVariable Long id) {
        return Result.ok(postService.getById(id));
    }

    /**
     * 创建
     */
    @PostMapping
    @SaCheckPermission("sys:post:add")
    @RepeatSubmit
    @Log(title = "岗位管理", businessType = BusinessType.INSERT)
    public Result<Void> create(@RequestBody SysPost post) {
        postService.create(post);
        return Result.ok();
    }

    /**
     * 更新
     */
    @PutMapping
    @SaCheckPermission("sys:post:edit")
    @Log(title = "岗位管理", businessType = BusinessType.UPDATE)
    public Result<Void> update(@RequestBody SysPost post) {
        postService.update(post);
        return Result.ok();
    }

    /**
     * 获取岗位树
     */
    @GetMapping("/tree")
    @SaCheckPermission("sys:post:list")
    public Result<List<SysPost>> tree() {
        return Result.ok(postService.tree());
    }

    /**
     * 移动岗位
     */
    @PostMapping("/{id}/move")
    @SaCheckPermission("sys:post:edit")
    @Log(title = "岗位管理", businessType = BusinessType.UPDATE)
    public Result<Void> move(@PathVariable Long id, @RequestParam Long parentId) {
        postService.move(id, parentId);
        return Result.ok();
    }

    /**
     * 删除
     */
    @DeleteMapping("/{id}")
    @SaCheckPermission("sys:post:delete")
    @Log(title = "岗位管理", businessType = BusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return Result.ok();
    }
}
