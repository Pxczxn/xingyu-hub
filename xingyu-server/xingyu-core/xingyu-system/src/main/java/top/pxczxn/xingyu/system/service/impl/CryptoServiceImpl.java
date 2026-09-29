package top.pxczxn.xingyu.system.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.util.RsaUtils;
import top.pxczxn.xingyu.crypto.CryptoService;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/**
 * RSA 密码解密与 legacy 响应加密（过渡）。
 * XYC1 响应加密由 {@link top.pxczxn.xingyu.crypto.advice.EncryptResponseBodyAdvice} 处理。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CryptoServiceImpl implements CryptoService {

    private static final String CONFIG_GROUP_SECURITY = "security";
    private static final String AES_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    private final SysConfigGroupService configGroupService;
    private final SystemConfigHelper configHelper;
    private final ObjectMapper objectMapper;

    private String publicKey;
    private String privateKey;
    private SecretKey legacyAesKey;

    @PostConstruct
    public void init() {
        reloadRsaKeys();
        ensureLegacyAesKey();
    }

    @Override
    public void reloadRsaKeys() {
        try {
            JsonNode config = getSecurityConfig();
            if (config != null) {
                publicKey = getStringValue(config, "encryptPublicKey");
                privateKey = getStringValue(config, "encryptPrivateKey");
            }
            if (isBlank(publicKey) || isBlank(privateKey)) {
                log.info("RSA 密钥未配置，等待管理端生成");
            } else {
                log.info("RSA 密钥加载成功");
            }
        } catch (Exception e) {
            log.error("加载 RSA 密钥失败", e);
        }
    }

    private void ensureLegacyAesKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256, new SecureRandom());
            legacyAesKey = keyGen.generateKey();
        } catch (Exception e) {
            log.error("生成 legacy AES 密钥失败", e);
        }
    }

    private JsonNode getSecurityConfig() {
        try {
            SysConfigGroup group = configGroupService.getByGroupCode(CONFIG_GROUP_SECURITY);
            if (group != null && group.getConfigValue() != null) {
                return objectMapper.readTree(group.getConfigValue());
            }
        } catch (Exception e) {
            log.error("读取安全配置失败", e);
        }
        return null;
    }

    private String getStringValue(JsonNode config, String key) {
        JsonNode node = config.get(key);
        return node != null && !node.isNull() ? node.asText() : null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isEmpty();
    }

    @Override
    public boolean isEnabled() {
        return configHelper.isEncryptEnabled();
    }

    @Override
    public String getProtocol() {
        return configHelper.getEncryptProtocol();
    }

    @Override
    public String getPublicKey() {
        if (isBlank(publicKey)) {
            reloadRsaKeys();
        }
        return publicKey;
    }

    @Override
    public String decrypt(String encryptedData) {
        if (encryptedData == null || encryptedData.isEmpty()) {
            return encryptedData;
        }
        try {
            return RsaUtils.decryptByPrivateKey(encryptedData, privateKey);
        } catch (Exception e) {
            log.error("RSA 解密失败", e);
            throw new RuntimeException("数据解密失败");
        }
    }

    @Override
    public String encrypt(String data) {
        if (data == null || data.isEmpty()) {
            return data;
        }
        try {
            return RsaUtils.encryptByPrivateKey(data, privateKey);
        } catch (Exception e) {
            log.error("RSA 加密失败", e);
            throw new RuntimeException("数据加密失败");
        }
    }

    /**
     * legacy 协议响应加密（iv.ciphertext），仅供过渡客户端使用。
     */
    @Override
    public String encryptResponse(String data) {
        if (data == null || data.isEmpty()) {
            return data;
        }
        if (legacyAesKey == null) {
            ensureLegacyAesKey();
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, legacyAesKey, gcmSpec);
            byte[] encryptedData = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(iv) + "."
                    + Base64.getEncoder().encodeToString(encryptedData);
        } catch (Exception e) {
            log.error("legacy AES 响应加密失败", e);
            throw new RuntimeException("数据加密失败");
        }
    }

    /**
     * 生成 RSA 密钥对并持久化到 security 配置（私钥仅存服务端）。
     */
    public String generateAndPersistRsaKeyPair() {
        try {
            Map<String, String> keyPair = RsaUtils.generateKeyPair();
            SysConfigGroup group = configGroupService.getByGroupCode(CONFIG_GROUP_SECURITY);
            if (group == null) {
                throw new IllegalStateException("security 配置分组不存在");
            }
            com.fasterxml.jackson.databind.node.ObjectNode config;
            if (group.getConfigValue() != null && !group.getConfigValue().isBlank()) {
                config = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(group.getConfigValue());
            } else {
                config = objectMapper.createObjectNode();
            }
            config.put("encryptPublicKey", keyPair.get(RsaUtils.PUBLIC_KEY));
            config.put("encryptPrivateKey", keyPair.get(RsaUtils.PRIVATE_KEY));
            configGroupService.saveConfig(CONFIG_GROUP_SECURITY, objectMapper.writeValueAsString(config));
            reloadRsaKeys();
            return keyPair.get(RsaUtils.PUBLIC_KEY);
        } catch (Exception e) {
            throw new RuntimeException("生成并保存 RSA 密钥失败", e);
        }
    }
}
