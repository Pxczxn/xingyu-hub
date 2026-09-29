package top.pxczxn.xingyu.admin.controller.system;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.entity.Customer;
import top.pxczxn.xingyu.system.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 客户管理
 */
@RestController
@RequestMapping("/system/customer")
@RequiredArgsConstructor
public class SysCustomerController {

    private final CustomerService customerService;

    @GetMapping("/page")
    @SaCheckPermission("system:customer:list")
    public Result<PageResult<Customer>> page(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) String name) {
        Page<Customer> result = customerService.page(page, pageSize, id, name);
        return Result.ok(PageResult.of(result));
    }

    @GetMapping("/{id}")
    @SaCheckPermission("system:customer:query")
    public Result<Customer> detail(@PathVariable Long id) {
        return Result.ok(customerService.getById(id));
    }

    @PostMapping
    @SaCheckPermission("system:customer:add")
    public Result<Void> create(@RequestBody Customer customer) {
        customerService.create(customer);
        return Result.ok();
    }

    @PutMapping
    @SaCheckPermission("system:customer:edit")
    public Result<Void> update(@RequestBody Customer customer) {
        customerService.update(customer);
        return Result.ok();
    }

    @DeleteMapping("/{ids}")
    @SaCheckPermission("system:customer:remove")
    public Result<Void> delete(@PathVariable String ids) {
        Long[] idArray = java.util.Arrays.stream(ids.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::valueOf)
                .toArray(Long[]::new);
        customerService.delete(idArray);
        return Result.ok();
    }
}
