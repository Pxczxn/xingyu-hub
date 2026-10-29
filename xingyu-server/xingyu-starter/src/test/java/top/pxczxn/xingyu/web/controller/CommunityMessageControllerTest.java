package top.pxczxn.xingyu.web.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.file.community.CommunityFilePurpose;
import top.pxczxn.xingyu.file.community.CommunityFileUploadCommand;
import top.pxczxn.xingyu.file.community.CommunityUploadedFileView;
import top.pxczxn.xingyu.file.service.SysFileService;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CommunityMessageControllerTest {

    @AfterEach
    void clearAuthContext() {
        CommunityAuthContext.clear();
    }

    @Test
    void anonymousUploadIsRejectedBeforeStorage() {
        SysFileService fileService = mock(SysFileService.class);
        CommunityMessageController controller = new CommunityMessageController(null, fileService);
        MockMultipartFile file = new MockMultipartFile(
                "file", "cover.png", "image/png", new byte[]{1, 2, 3});

        assertThrows(IllegalStateException.class, () -> controller.uploadMessageAttachment(file));
        verifyNoInteractions(fileService);
    }

    @Test
    void uploadsAttachmentWithCommunityUserAsCreator() {
        SysFileService fileService = mock(SysFileService.class);
        CommunityMessageController controller = new CommunityMessageController(null, fileService);
        MockMultipartFile file = new MockMultipartFile(
                "file", "cover.png", "image/png", new byte[]{1, 2, 3});

        CommunityUser user = new CommunityUser();
        user.setId("user-1");
        CommunityAuthContext.set(user, new CommunitySession());

        CommunityUploadedFileView uploaded = CommunityUploadedFileView.builder()
                .fileId(77L)
                .url("/api/v1/media/private/77")
                .name("cover.png")
                .mimeType("image/png")
                .visibility("private")
                .purpose(CommunityFilePurpose.MESSAGE_ATTACHMENT.name())
                .build();
        when(fileService.uploadCommunity(eq(file), any(CommunityFileUploadCommand.class)))
                .thenReturn(uploaded);

        // 上传返回 fileId 才是附件可下载的关键：静态路径被拒绝，成员校验端点通过 sys_file.id 取字节。
        Map<String, Object> result = controller.uploadMessageAttachment(file);

        assertEquals("/api/v1/media/private/77", result.get("url"));
        assertEquals("cover.png", result.get("name"));
        assertEquals("image/png", result.get("mimeType"));
        assertEquals(77L, result.get("fileId"));

        ArgumentCaptor<CommunityFileUploadCommand> commandCaptor =
                ArgumentCaptor.forClass(CommunityFileUploadCommand.class);
        verify(fileService).uploadCommunity(eq(file), commandCaptor.capture());
        assertEquals(CommunityFilePurpose.MESSAGE_ATTACHMENT, commandCaptor.getValue().getPurpose());
        assertEquals("user-1", commandCaptor.getValue().getOwnerUserId());
    }
}
