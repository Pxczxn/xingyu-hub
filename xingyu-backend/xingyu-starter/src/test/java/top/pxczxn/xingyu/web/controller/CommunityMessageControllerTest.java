package top.pxczxn.xingyu.web.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import top.pxczxn.xingyu.file.service.SysFileService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class CommunityMessageControllerTest {

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
}
