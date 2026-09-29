package top.pxczxn.xingyu.admin.controller.file;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.file.entity.SysFileConfig;
import top.pxczxn.xingyu.file.service.SysFileConfigService;
import top.pxczxn.xingyu.system.annotation.Log;
import top.pxczxn.xingyu.system.annotation.RepeatSubmit;

import java.util.List;

@RestController
@RequestMapping("/sys/file-config")
@RequiredArgsConstructor
public class SysFileConfigController {

    private final SysFileConfigService fileConfigService;

    @GetMapping("/page")
    @SaCheckPermission("sys:file:list")
    public Result<PageResult<SysFileConfig>> page(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String storageType) {
        return Result.ok(fileConfigService.page(page, pageSize, name, storageType));
    }

    @GetMapping("/list")
    @SaCheckPermission("sys:file:list")
    public Result<List<SysFileConfig>> list() {
        return Result.ok(fileConfigService.listEnabled());
    }

    @GetMapping("/{id}")
    @SaCheckPermission("sys:file:list")
    public Result<SysFileConfig> detail(@PathVariable Long id) {
        return Result.ok(fileConfigService.getById(id));
    }

    @GetMapping("/master")
    @SaCheckPermission("sys:file:list")
    public Result<SysFileConfig> master() {
        return Result.ok(fileConfigService.getMaster());
    }

    @PostMapping
    @SaCheckPermission("sys:file:upload")
    @RepeatSubmit
    @Log(title = "创建文件存储配置", businessType = Log.BusinessType.INSERT)
    public Result<Void> create(@RequestBody SysFileConfig config) {
        fileConfigService.create(config);
        return Result.ok();
    }

    @PutMapping
    @SaCheckPermission("sys:file:upload")
    @Log(title = "更新文件存储配置", businessType = Log.BusinessType.UPDATE)
    public Result<Void> update(@RequestBody SysFileConfig config) {
        fileConfigService.update(config);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    @SaCheckPermission("sys:file:delete")
    @Log(title = "删除文件存储配置", businessType = Log.BusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        fileConfigService.delete(id);
        return Result.ok();
    }

    @PutMapping("/master/{id}")
    @SaCheckPermission("sys:file:upload")
    @Log(title = "设置主文件存储", businessType = Log.BusinessType.UPDATE)
    public Result<Void> setMaster(@PathVariable Long id) {
        fileConfigService.setMaster(id);
        return Result.ok();
    }

    @PostMapping("/test")
    @SaCheckPermission("sys:file:upload")
    public Result<Boolean> test(@RequestBody SysFileConfig config) {
        return Result.ok(fileConfigService.testConnection(config));
    }
}
