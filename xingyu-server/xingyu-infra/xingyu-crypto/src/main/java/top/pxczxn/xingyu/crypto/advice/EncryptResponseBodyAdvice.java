package top.pxczxn.xingyu.crypto.advice;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.crypto.CryptoConfigProvider;
import top.pxczxn.xingyu.crypto.CryptoService;
import top.pxczxn.xingyu.crypto.EncryptResponse;
import top.pxczxn.xingyu.crypto.engine.Xyc1ResponseCipher;
import top.pxczxn.xingyu.crypto.protocol.CryptoHeaders;
import top.pxczxn.xingyu.crypto.scope.CryptoScopeResolver;
import top.pxczxn.xingyu.crypto.session.CryptoSession;
import top.pxczxn.xingyu.crypto.session.CryptoSessionManager;

import java.util.List;
import java.util.Optional;

/**
 * 管理端 JSON 响应加密（XYC1 / legacy）。
 */
@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class EncryptResponseBodyAdvice implements ResponseBodyAdvice<Object> {

    private static final String LEGACY_PROTOCOL = "legacy";

    private final CryptoService cryptoService;
    private final CryptoSessionManager sessionManager;
    private final ObjectMapper objectMapper;
    private final CryptoConfigProvider configProvider;

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        if (CryptoScopeResolver.isCommunityController(returnType.getContainingClass().getPackageName())) {
            return false;
        }
        if (!cryptoService.isEnabled()) {
            return false;
        }
        if (configProvider.isGlobalEncrypt()) {
            return CryptoScopeResolver.isAdminController(returnType.getContainingClass().getPackageName());
        }
        return returnType.hasMethodAnnotation(EncryptResponse.class);
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        try {
            if (body == null) {
                return body;
            }
            String path = request.getURI().getPath();
            if (!CryptoScopeResolver.shouldEncryptJsonResponse(
                    returnType.getContainingClass().getPackageName(),
                    selectedContentType,
                    body.getClass(),
                    path
            )) {
                return body;
            }

            String jsonData = extractJsonPayload(body);
            if (jsonData == null) {
                return body;
            }

            if (LEGACY_PROTOCOL.equalsIgnoreCase(cryptoService.getProtocol())) {
                String encrypted = cryptoService.encryptResponse(jsonData);
                return wrapEncryptedPayload(body, encrypted);
            }

            return encryptXyc1(body, jsonData, request);
        } catch (Exception e) {
            log.error("响应加密失败", e);
            return body;
        }
    }

    private Object encryptXyc1(Object body, String jsonData, ServerHttpRequest request) {
        List<String> sessionIds = request.getHeaders().get(CryptoHeaders.SESSION_ID);
        List<String> requestIds = request.getHeaders().get(CryptoHeaders.REQUEST_ID);
        if (sessionIds == null || sessionIds.isEmpty() || requestIds == null || requestIds.isEmpty()) {
            log.warn("XYC1 响应加密跳过：缺少 {} 或 {}", CryptoHeaders.SESSION_ID, CryptoHeaders.REQUEST_ID);
            return body;
        }
        String sessionId = sessionIds.getFirst().trim();
        String requestId = requestIds.getFirst().trim();
        Optional<CryptoSession> session = sessionManager.get(sessionId);
        if (session.isEmpty()) {
            log.warn("XYC1 响应加密跳过：session 不存在或已过期 sid={}", sessionId);
            return body;
        }
        var envelope = Xyc1ResponseCipher.encrypt(
                session.get().getMasterKey(),
                sessionId,
                requestId,
                jsonData
        );
        return wrapEncryptedPayload(body, envelope);
    }

    private String extractJsonPayload(Object body) throws Exception {
        if (body instanceof Result<?> result) {
            Object data = result.getData();
            if (data == null) {
                return null;
            }
            return objectMapper.writeValueAsString(data);
        }
        if (body instanceof String str) {
            return str;
        }
        return objectMapper.writeValueAsString(body);
    }

    private Object wrapEncryptedPayload(Object body, Object encryptedPayload) {
        if (body instanceof Result<?>) {
            return Result.ok(encryptedPayload);
        }
        return Result.ok(encryptedPayload);
    }
}
