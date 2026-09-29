package top.pxczxn.xingyu.admin.controller.auth;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.crypto.protocol.CryptoHeaders;
import top.pxczxn.xingyu.system.crypto.CryptoSessionService;

/**
 * Crypto Session 握手。
 */
@RestController
@RequestMapping("/crypto/session")
@RequiredArgsConstructor
public class CryptoSessionController {

    private final CryptoSessionService cryptoSessionService;

    @PostMapping("/handshake")
    public Result<CryptoSessionService.HandshakeResult> handshake(@RequestBody HandshakeRequest request) {
        return Result.ok(cryptoSessionService.handshake(request.getClientPublicKey()));
    }

    @DeleteMapping
    public Result<Void> destroy(@RequestHeader(value = CryptoHeaders.SESSION_ID, required = false) String sessionId) {
        cryptoSessionService.invalidate(sessionId);
        return Result.ok();
    }

    @Data
    public static class HandshakeRequest {
        private String clientPublicKey;
    }
}
