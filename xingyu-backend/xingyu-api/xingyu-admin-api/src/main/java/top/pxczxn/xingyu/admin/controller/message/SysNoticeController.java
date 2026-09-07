package top.pxczxn.xingyu.admin.controller.message;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.dto.SysNoticeVo;
import top.pxczxn.xingyu.system.entity.SysNoticeSendLog;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysNoticeService;
import top.pxczxn.xingyu.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/sys/notice")
@RequiredArgsConstructor
public class SysNoticeController {

    private final SysNoticeService noticeService;
    private final SysUserService userService;

    @GetMapping("/page")
    @SaCheckPermission("sys:notice:list")
    public Result<PageResult<SysNoticeVo>> page(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) Integer noticeType,
            @RequestParam(required = false) Integer status) {
        return Result.ok(noticeService.page(page, pageSize, title, noticeType, status));
    }

    @GetMapping("/my")
    public Result<PageResult<SysNoticeVo>> myNotices(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Integer isRead) {
        Long userId = StpUtil.getLoginIdAsLong();
        return Result.ok(noticeService.myNotices(userId, page, pageSize, isRead));
    }

    @GetMapping("/{id}")
    @SaCheckPermission("sys:notice:list")
    public Result<SysNoticeVo> detail(@PathVariable Long id) {
        return Result.ok(noticeService.detail(id));
    }

    @PostMapping
    @SaCheckPermission("sys:notice:add")
    public Result<Void> create(@RequestBody SysNoticeVo notice) {
        Long userId = StpUtil.getLoginIdAsLong();
        SysUser user = userService.getDetail(userId);
        noticeService.create(notice, userId, user.getNickname());
        return Result.ok();
    }

    @PutMapping
    @SaCheckPermission("sys:notice:edit")
    public Result<Void> update(@RequestBody SysNoticeVo notice) {
        noticeService.update(notice);
        return Result.ok();
    }

    @DeleteMapping("/{id}")
    @SaCheckPermission("sys:notice:delete")
    public Result<Void> delete(@PathVariable Long id) {
        noticeService.delete(id);
        return Result.ok();
    }

    @PostMapping("/{id}/publish")
    @SaCheckPermission("sys:notice:edit")
    public Result<Void> publish(@PathVariable Long id) {
        noticeService.publish(id, StpUtil.getLoginIdAsLong());
        return Result.ok();
    }

    @PostMapping("/{id}/read")
    public Result<Void> markRead(@PathVariable Long id) {
        noticeService.markRead(StpUtil.getLoginIdAsLong(), id);
        return Result.ok();
    }

    @PostMapping("/read-all")
    public Result<Void> markAllRead() {
        noticeService.markAllRead(StpUtil.getLoginIdAsLong());
        return Result.ok();
    }

    @GetMapping("/unread-count")
    public Result<Integer> unreadCount() {
        return Result.ok(noticeService.unreadCount(StpUtil.getLoginIdAsLong()));
    }

    @GetMapping("/channels")
    public Result<List<Map<String, Object>>> channels() {
        return Result.ok(noticeService.availableChannels());
    }

    @GetMapping("/{id}/send-logs")
    @SaCheckPermission("sys:notice:list")
    public Result<List<SysNoticeSendLog>> sendLogs(@PathVariable Long id) {
        return Result.ok(noticeService.sendLogs(id));
    }

    @PostMapping("/{id}/retry")
    @SaCheckPermission("sys:notice:edit")
    public Result<Void> retry(@PathVariable Long id, @RequestParam String channel) {
        noticeService.retryChannel(id, channel);
        return Result.ok();
    }
}
