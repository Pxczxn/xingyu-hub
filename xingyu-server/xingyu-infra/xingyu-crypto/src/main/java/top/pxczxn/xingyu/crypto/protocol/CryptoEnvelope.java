package top.pxczxn.xingyu.crypto.protocol;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * XYC1 响应加密信封。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CryptoEnvelope {

    private String v;
    private String sid;
    private String rid;
    private String alg;
    private long ts;
    private String nonce;
    private String data;
}
