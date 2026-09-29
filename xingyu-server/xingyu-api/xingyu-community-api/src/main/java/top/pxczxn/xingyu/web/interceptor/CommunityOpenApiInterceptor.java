package top.pxczxn.xingyu.web.interceptor;

import top.pxczxn.xingyu.community.context.CommunityOpenApiContext;
import top.pxczxn.xingyu.community.entity.CommunityApiToken;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.service.CommunityApiTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class CommunityOpenApiInterceptor implements HandlerInterceptor {

    private final CommunityApiTokenService apiTokenService;
    private final CommunityUserMapper userMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        CommunityApiToken token = apiTokenService.requireActiveToken(request.getHeader("Authorization"));
        CommunityUser user = userMapper.selectById(token.getUserId());
        CommunityOpenApiContext.set(user, token);
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex) {
        CommunityOpenApiContext.clear();
    }
}
