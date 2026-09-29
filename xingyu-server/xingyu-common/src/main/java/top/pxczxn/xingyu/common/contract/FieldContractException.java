package top.pxczxn.xingyu.common.contract;

import lombok.Getter;

@Getter
public class FieldContractException extends ContractException {
    private final String field;

    public FieldContractException(String field, String message) {
        super(ErrorCode.VALIDATION_FAILED, field + ": " + message);
        this.field = field;
    }
}
