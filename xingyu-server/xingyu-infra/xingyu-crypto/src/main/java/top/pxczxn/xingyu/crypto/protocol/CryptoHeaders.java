package top.pxczxn.xingyu.crypto.protocol;

/**
 * 管理端接口加密 HTTP 头。
 */
public final class CryptoHeaders {

    public static final String SESSION_ID = "X-Crypto-Session-Id";
    public static final String REQUEST_ID = "X-Crypto-Request-Id";

    public static final String PROTOCOL_VERSION = "XYC1";
    public static final String ALGORITHM = "A256GCM";
    public static final String SESSION_INFO = "xingyu-admin:session:v1";
    public static final String RESPONSE_INFO_PREFIX = "xingyu-admin:res:";

    private CryptoHeaders() {
    }
}
