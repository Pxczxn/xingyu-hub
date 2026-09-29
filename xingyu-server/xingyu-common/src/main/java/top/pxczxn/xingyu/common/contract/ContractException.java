package top.pxczxn.xingyu.common.contract;

import lombok.Getter;

@Getter
public class ContractException extends RuntimeException {
    private final ErrorCode errorCode;
    private final String detail;

    public ContractException(ErrorCode errorCode) {
        this(errorCode, errorCode.getTitle());
    }

    public ContractException(ErrorCode errorCode, String detail) {
        super(detail);
        this.errorCode = errorCode;
        this.detail = detail;
    }
}
