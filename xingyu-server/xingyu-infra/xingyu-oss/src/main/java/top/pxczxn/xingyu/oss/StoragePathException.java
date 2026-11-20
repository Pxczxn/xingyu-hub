package top.pxczxn.xingyu.oss;

/**
 * 存储路径不合法。消息固定，避免把服务器路径带回调用方。
 */
public class StoragePathException extends RuntimeException {

    public static final String MESSAGE = "非法文件路径";

    public StoragePathException() {
        super(MESSAGE);
    }
}
