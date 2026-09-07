package top.pxczxn.xingyu.crypto;

/**
 * 加密服务接口
 */
public interface CryptoService {

    /**
     * 是否启用加密
     */
    boolean isEnabled();

    /**
     * 获取公钥
     */
    String getPublicKey();

    /**
     * 加密协议：XYC1（默认）或 legacy（过渡）
     */
    String getProtocol();

    /**
     * RSA解密数据（使用私钥解密请求数据）
     */
    String decrypt(String encryptedData);

    /**
     * RSA加密数据（使用私钥）
     */
    String encrypt(String data);

    /**
     * AES加密响应数据
     */
    String encryptResponse(String data);

    /**
     * 重新从配置加载 RSA 密钥
     */
    void reloadRsaKeys();
}
