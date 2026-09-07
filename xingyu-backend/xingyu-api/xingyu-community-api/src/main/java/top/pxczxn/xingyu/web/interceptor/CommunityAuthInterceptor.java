package top.pxczxn.xingyu.web.interceptor;

import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class CommunityAuthInterceptor implements HandlerInterceptor {

    private final CommunityAccountService accountService;
    private final CommunityUserMapper userMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (isPublicRead(request)) {
            return true;
        }
        String token = request.getHeader("satoken");
        CommunitySession session = accountService.requireActiveSession(token);
        CommunityUser user = userMapper.selectById(session.getUserId());
        CommunityAuthContext.set(user, session);
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

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        CommunityAuthContext.clear();
    }
}
