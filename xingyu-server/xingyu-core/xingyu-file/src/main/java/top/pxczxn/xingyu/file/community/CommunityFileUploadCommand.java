package top.pxczxn.xingyu.file.community;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CommunityFileUploadCommand {
    CommunityFilePurpose purpose;
    String ownerUserId;
    String draftId;
    String articleId;
    String seriesId;
    String galaxyId;
    String momentId;
}
