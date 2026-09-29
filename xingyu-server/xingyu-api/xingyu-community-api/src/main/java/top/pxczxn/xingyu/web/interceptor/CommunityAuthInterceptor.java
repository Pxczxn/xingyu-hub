package top.pxczxn.xingyu.web.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.ProblemDetails;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class CommunityAuthInterceptor implements HandlerInterceptor {

    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (isPublicRead(request)) {
            return true;
        }
        String token = request.getHeader("satoken");
        CommunitySession session = accountService.requireActiveSession(token);
        CommunityUser user = userMapper.selectById(session.getUserId());
        CommunityAuthContext.set(user, session);
        if (accountService.requiresPasswordChange(user.getId()) && !isPasswordChangeAllowed(request)) {
            writeProblem(
                    response,
                    request,
                    ErrorCode.AUTH_FORBIDDEN,
                    "请先修改密码后再继续使用社区功能");
            return false;
        }
        return true;
    }

    private boolean isPublicRead(HttpServletRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return "/api/v1/moments".equals(uri)
                || uri.startsWith("/api/v1/moments/")
                || "/api/v1/me/home".equals(uri);
    }

    private boolean isPasswordChangeAllowed(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if ("GET".equalsIgnoreCase(request.getMethod()) && "/api/v1/me".equals(uri)) {
            return true;
        }
        return "POST".equalsIgnoreCase(request.getMethod())
                && "/api/v1/me/password/force-change".equals(uri);
    }

    private void writeProblem(
            HttpServletResponse response,
            HttpServletRequest request,
            ErrorCode code,
            String detail) {
        try {
            response.setStatus(code.getStatus().value());
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ProblemDetails body = ProblemDetails.of(code, detail, request.getHeader("X-Request-Id"));
            response.getWriter().write(objectMapper.writeValueAsString(body));
        } catch (Exception ex) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        CommunityAuthContext.clear();
    }
}
