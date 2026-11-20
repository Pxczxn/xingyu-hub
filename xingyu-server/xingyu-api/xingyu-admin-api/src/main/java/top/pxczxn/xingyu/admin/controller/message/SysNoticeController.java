package top.pxczxn.xingyu.admin.controller.message;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.system.dto.SysNoticeConsoleRecipient;
import top.pxczxn.xingyu.system.dto.SysNoticePublishResult;
import top.pxczxn.xingyu.system.dto.SysNoticeVo;
import top.pxczxn.xingyu.system.entity.SysNoticeSendLog;
import top.pxczxn.xingyu.community.identity.CommunityIdentityService;
import top.pxczxn.xingyu.system.service.SysNoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/sys/notice")
@RequiredArgsConstructor
public class SysNoticeController {

    private final SysNoticeService noticeService;
    private final CommunityIdentityService communityIdentityService;

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
        String communityUserId = StpUtil.getLoginIdAsString();
        return Result.ok(noticeService.myNotices(communityUserId, page, pageSize, isRead));
    }

    @GetMapping("/{id}")
    @SaCheckPermission("sys:notice:list")
    public Result<SysNoticeVo> detail(@PathVariable Long id) {
        return Result.ok(noticeService.detail(id));
    }

    @PostMapping
    @SaCheckPermission("sys:notice:add")
    public Result<Void> create(@RequestBody SysNoticeVo notice) {
        String communityUserId = StpUtil.getLoginIdAsString();
        noticeService.create(notice, communityIdentityService.resolveDisplayName(communityUserId));
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

    @GetMapping("/console-recipients")
    @SaCheckPermission("sys:notice:list")
    public Result<List<SysNoticeConsoleRecipient>> consoleRecipients() {
        return Result.ok(noticeService.listConsoleRecipients());
    }

    @PostMapping("/{id}/publish")
    @SaCheckPermission("sys:notice:edit")
    public Result<SysNoticePublishResult> publish(@PathVariable Long id) {
        return Result.ok(noticeService.publish(id));
    }

    @PostMapping("/{id}/read")
    public Result<Void> markRead(@PathVariable Long id) {
        noticeService.markRead(StpUtil.getLoginIdAsString(), id);
        return Result.ok();
    }

    @PostMapping("/read-all")
    public Result<Void> markAllRead() {
        noticeService.markAllRead(StpUtil.getLoginIdAsString());
        return Result.ok();
    }

    @GetMapping("/unread-count")
    public Result<Integer> unreadCount() {
        return Result.ok(noticeService.unreadCount(StpUtil.getLoginIdAsString()));
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
