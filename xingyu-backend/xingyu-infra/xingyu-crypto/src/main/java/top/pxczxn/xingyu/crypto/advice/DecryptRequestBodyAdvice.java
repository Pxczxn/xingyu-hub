package top.pxczxn.xingyu.crypto.advice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;
import top.pxczxn.xingyu.crypto.CryptoService;
import top.pxczxn.xingyu.crypto.scope.CryptoScopeResolver;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;

/**
 * 管理端请求体解密（RSA 密码字段）。
 * 请求体 XYC1 解密留待下一阶段。
 */
@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class DecryptRequestBodyAdvice extends RequestBodyAdviceAdapter {

    private final CryptoService cryptoService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean supports(
            MethodParameter methodParameter,
            Type targetType,
            Class<? extends HttpMessageConverter<?>> converterType
    ) {
        if (!cryptoService.isEnabled()) {
            return false;
        }
        return CryptoScopeResolver.shouldDecryptRequest(methodParameter.getContainingClass().getPackageName());
    }

    @Override
    public HttpInputMessage beforeBodyRead(
            HttpInputMessage inputMessage,
            MethodParameter parameter,
            Type targetType,
            Class<? extends HttpMessageConverter<?>> converterType
    ) throws IOException {
        String body;
        try {
            body = new String(inputMessage.getBody().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("读取请求体失败", e);
            return inputMessage;
        }

        if (body == null || body.isEmpty()) {
            return new DecryptedHttpInputMessage(inputMessage, "");
        }

        try {
            JsonNode jsonNode = objectMapper.readTree(body);
            if (jsonNode.isObject()) {
                ObjectNode objectNode = (ObjectNode) jsonNode;
                boolean modified = false;
                for (String field : new String[]{"password", "oldPassword", "newPassword"}) {
                    if (objectNode.has(field) && objectNode.get(field).isTextual()) {
                        String encrypted = objectNode.get(field).asText();
                        if (isLikelyRsaCipher(encrypted)) {
                            try {
                                objectNode.put(field, cryptoService.decrypt(encrypted));
                                modified = true;
                            } catch (Exception e) {
                                log.debug("{} 字段解密失败，可能是明文", field);
                            }
                        }
                    }
                }
                if (modified) {
                    return new DecryptedHttpInputMessage(inputMessage, objectMapper.writeValueAsString(objectNode));
                }
            }
            return new DecryptedHttpInputMessage(inputMessage, body);
        } catch (Exception e) {
            log.error("请求解密处理异常", e);
            return new DecryptedHttpInputMessage(inputMessage, body);
        }
    }

    private boolean isLikelyRsaCipher(String data) {
        if (data == null || data.length() < 100) {
            return false;
        }
        try {
            java.util.Base64.getDecoder().decode(data);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static class DecryptedHttpInputMessage implements HttpInputMessage {
        private final HttpInputMessage original;
        private final String body;

        DecryptedHttpInputMessage(HttpInputMessage original, String body) {
            this.original = original;
            this.body = body;
        }

        @Override
        public InputStream getBody() {
            return new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
        }

        @Override
        public org.springframework.http.HttpHeaders getHeaders() {
            return original.getHeaders();
        }
    }
}
