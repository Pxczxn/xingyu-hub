package top.pxczxn.xingyu.web.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.file.entity.SysFile;
import top.pxczxn.xingyu.file.service.SysFileService;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
    void rejectsExecutableAttachmentBeforeStorage() {
        SysFileService fileService = mock(SysFileService.class);
        CommunityMessageController controller = new CommunityMessageController(null, fileService);
        MockMultipartFile file = new MockMultipartFile(
                "file", "danger.exe", "application/x-msdownload", new byte[]{1, 2, 3});

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.uploadMessageAttachment(file));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
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

        SysFile uploaded = new SysFile();
        uploaded.setId(77L);
        uploaded.setUrl("/api/v1/admin/files/community/messages/cover.png");
        uploaded.setOriginalName("cover.png");
        uploaded.setFileType("image/png");
        when(fileService.upload(eq(file), eq("community/messages"), isNull(), eq("user-1")))
                .thenReturn(uploaded);

        // 2026-10-06: the upload also returns `fileId`. It is what makes the attachment
        // downloadable at all — the static path is refused and the member-checked
        // endpoint resolves bytes through sys_file.id.
        Map<String, Object> result = controller.uploadMessageAttachment(file);

        assertEquals("/api/v1/admin/files/community/messages/cover.png", result.get("url"));
        assertEquals("cover.png", result.get("name"));
        assertEquals("image/png", result.get("mimeType"));
        assertEquals(77L, result.get("fileId"));
        verify(fileService).upload(eq(file), eq("community/messages"), isNull(), eq("user-1"));
    }
}
