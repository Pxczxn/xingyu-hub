package top.pxczxn.xingyu.api;

import top.pxczxn.xingyu.common.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Result<Map<String, String>> health(HttpServletRequest request) {
        Map<String, String> body = new HashMap<>();
        body.put("status", "UP");
        String requestId = request.getHeader("X-Request-Id");
        if (requestId != null && !requestId.isBlank()) {
            body.put("requestId", requestId);
        }
        return Result.ok(body);
    }
}
