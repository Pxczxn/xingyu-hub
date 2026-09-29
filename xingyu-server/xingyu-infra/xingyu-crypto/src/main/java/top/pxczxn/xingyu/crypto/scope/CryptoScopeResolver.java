package top.pxczxn.xingyu.crypto.scope;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * 管理端 JSON API 加密范围判定。
 */
public final class CryptoScopeResolver {

    private static final String ADMIN_PACKAGE = "top.pxczxn.xingyu.admin";

    private CryptoScopeResolver() {
    }

    public static boolean isAdminController(String packageName) {
        return packageName != null && packageName.startsWith(ADMIN_PACKAGE);
    }

    public static boolean isCommunityController(String packageName) {
        return packageName != null && packageName.startsWith("top.pxczxn.xingyu.web");
    }

    public static boolean shouldEncryptJsonResponse(
            String packageName,
            MediaType contentType,
            Class<?> bodyType,
            String path
    ) {
        if (!isAdminController(packageName) || isCommunityController(packageName)) {
            return false;
        }
        if (bodyType == byte[].class || StreamingResponseBody.class.isAssignableFrom(bodyType)) {
            return false;
        }
        if (contentType != null && !MediaType.APPLICATION_JSON.isCompatibleWith(contentType)) {
            return false;
        }
        if (path != null) {
            for (String exclude : EXCLUDE_PATHS) {
                if (path.contains(exclude)) {
                    return false;
                }
            }
        }
        return true;
    }

    public static boolean shouldDecryptRequest(String packageName) {
        return isAdminController(packageName) && !isCommunityController(packageName);
    }

    private static final String[] EXCLUDE_PATHS = {
            "/crypto/",
            "/auth/login",
            "/auth/register",
            "/auth/captcha",
            "/auth/sms-code",
            "/sys/config-group/public",
            "/file/",
            "/sys/file/",
            "/health"
    };
}
