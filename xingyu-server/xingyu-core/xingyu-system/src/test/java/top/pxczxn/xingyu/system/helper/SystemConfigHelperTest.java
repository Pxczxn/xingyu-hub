package top.pxczxn.xingyu.system.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemConfigHelperTest {

    @Test
    void usesDefaultCommunityMailTemplateWhenPersistedTemplateIsBlank() {
        SysConfigGroupService service = mock(SysConfigGroupService.class);
        SysConfigGroup group = new SysConfigGroup();
        group.setConfigValue("{\"verifyEmail\":\"\",\"passwordResetLink\":\"\"}");
        when(service.getByGroupCode("emailTemplate")).thenReturn(group);

        SystemConfigHelper helper = new SystemConfigHelper(service, new ObjectMapper());

        assertEquals("请点击链接完成邮箱验证：{link}", helper.getEmailTemplateVerifyEmailLink());
        assertEquals("请点击链接设置新密码：{link}", helper.getEmailTemplatePasswordResetLink());
    }
}
