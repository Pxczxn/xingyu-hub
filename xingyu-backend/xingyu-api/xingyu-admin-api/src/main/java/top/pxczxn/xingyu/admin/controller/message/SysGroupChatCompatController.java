package top.pxczxn.xingyu.admin.controller.message;

import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.common.result.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 旧版 Mars 群聊 API 兼容层。
 * sys_chat_group 表已在 V019 移除，此处返回空数据避免前端 404。
 */
@RestController
@RequestMapping("/chat/group")
@RequiredArgsConstructor
public class SysGroupChatCompatController {

    @PostMapping("/create")
    public Result<Object> create(@RequestBody Map<String, Object> body) {
        return Result.fail("群聊功能已迁移，请使用社区消息 API");
    }

    @GetMapping("/list")
    public Result<List<Object>> list() {
        return Result.ok(Collections.emptyList());
    }

    @GetMapping("/{groupId}")
    public Result<Object> detail(@PathVariable Long groupId) {
        return Result.fail(404, "群聊不存在");
    }

    @PutMapping("/update")
    public Result<Void> update(@RequestBody Map<String, Object> body) {
        return Result.ok();
    }

    @DeleteMapping("/{groupId}")
    public Result<Void> dissolve(@PathVariable Long groupId) {
        return Result.ok();
    }

    @PostMapping("/{groupId}/quit")
    public Result<Void> quit(@PathVariable Long groupId) {
        return Result.ok();
    }

    @GetMapping("/{groupId}/members")
    public Result<List<Object>> members(@PathVariable Long groupId) {
        return Result.ok(Collections.emptyList());
    }

    @PostMapping("/{groupId}/members")
    public Result<Void> addMembers(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        return Result.ok();
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public Result<Void> removeMember(@PathVariable Long groupId, @PathVariable Long memberId) {
        return Result.ok();
    }

    @PostMapping("/{groupId}/admin/{memberId}")
    public Result<Void> setAdmin(
            @PathVariable Long groupId,
            @PathVariable Long memberId,
            @RequestParam(required = false) Boolean isAdmin) {
        return Result.ok();
    }

    @PostMapping("/{groupId}/mute/{memberId}")
    public Result<Void> setMuted(
            @PathVariable Long groupId,
            @PathVariable Long memberId,
            @RequestParam(required = false) Boolean muted) {
        return Result.ok();
    }

    @PostMapping("/{groupId}/transfer/{newOwnerId}")
    public Result<Void> transferOwner(@PathVariable Long groupId, @PathVariable Long newOwnerId) {
        return Result.ok();
    }

    @PostMapping("/{groupId}/message")
    public Result<Object> sendMessage(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        return Result.fail("群聊功能已迁移，请使用社区消息 API");
    }

    @GetMapping("/{groupId}/messages")
    public Result<PageResult<Object>> messages(
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "50") Integer pageSize) {
        return Result.ok(PageResult.empty());
    }
}
