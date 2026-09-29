package top.pxczxn.xingyu.admin.controller.community;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.mapper.ConversationMapper;

@RestController
@RequestMapping("/operations/groups")
@RequiredArgsConstructor
public class AdminGroupController {
    private final ConversationMapper mapper;
    @GetMapping
    public Result<?> list(@RequestParam(defaultValue = "100") int limit) {
        return Result.ok(mapper.listGroupsForAdmin(Math.max(1, Math.min(limit, 200))));
    }
}
