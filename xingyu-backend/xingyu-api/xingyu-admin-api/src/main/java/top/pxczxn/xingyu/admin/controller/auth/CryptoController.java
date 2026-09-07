package top.pxczxn.xingyu.admin.controller.auth;

import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.crypto.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 加密控制器
 */
@RestController
@RequestMapping("/crypto")
@RequiredArgsConstructor
public class CryptoController {

    private final CryptoService cryptoService;

    /**
     * 获取加密配置（公钥与协议，不下发对称密钥）
     */
    @GetMapping("/config")
    public Result<Map<String, Object>> getConfig() {
        Map<String, Object> result = new HashMap<>();
        result.put("enabled", cryptoService.isEnabled());
        result.put("publicKey", cryptoService.getPublicKey());
        result.put("protocol", cryptoService.getProtocol());
        return Result.ok(result);
    }

    /**
     * 获取公钥
     */
    @GetMapping("/publicKey")
    public Result<String> getPublicKey() {
        return Result.ok(cryptoService.getPublicKey());
    }
}
