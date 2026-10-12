package top.pxczxn.xingyu.file.community;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CommunityUploadedFileView {
    long fileId;
    String url;
    String name;
    String mimeType;
    String visibility;
    String purpose;
}
