package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.result.PageResult;
import top.pxczxn.xingyu.system.entity.SysPost;
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.entity.SysUserPost;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.mapper.SysDeptMapper;
import top.pxczxn.xingyu.system.mapper.SysPostMapper;
import top.pxczxn.xingyu.system.mapper.SysRoleMapper;
import top.pxczxn.xingyu.system.mapper.SysUserMapper;
import top.pxczxn.xingyu.system.mapper.SysUserPostMapper;
import top.pxczxn.xingyu.system.mapper.SysUserRoleMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysUserServiceImplPageTest {

    private SysUserMapper userMapper;
    private SysUserPostMapper userPostMapper;
    private SysPostMapper postMapper;
    private SysUserServiceImpl service;

    @BeforeEach
    void setUp() {
        userMapper = mock(SysUserMapper.class);
        userPostMapper = mock(SysUserPostMapper.class);
        postMapper = mock(SysPostMapper.class);
        service = new SysUserServiceImpl(
                mock(SysUserRoleMapper.class),
                userPostMapper,
                mock(SysDeptMapper.class),
                postMapper,
                mock(SysRoleMapper.class),
                mock(SystemConfigHelper.class));
        TestMapperSupport.injectBaseMapper(service, userMapper);
    }

    @Test
    void pageBatchLoadsPostsForCurrentUsersOnly() {
        SysUser alice = user(1L, "secret");
        SysUser bob = user(2L, "also-secret");
        Page<SysUser> page = new Page<>(1, 10);
        page.setRecords(List.of(alice, bob));
        page.setTotal(2);
        when(userMapper.selectUserPage(any(IPage.class), any())).thenReturn(page);
        when(userPostMapper.listByUserIds(List.of(1L, 2L))).thenReturn(List.of(
                link(1L, 10L),
                link(1L, 11L),
                link(2L, 10L)));
        when(postMapper.selectBatchIds(org.mockito.ArgumentMatchers.anyCollection())).thenReturn(List.of(
                post(10L, "研发"),
                post(11L, "运营")));

        PageResult<SysUser> result = service.page(1, 10, null, null, null, null, null, null, null);

        assertEquals(2, result.getList().size());
        assertNull(result.getList().get(0).getPassword());
        assertEquals("研发,运营", result.getList().get(0).getPostNames());
        assertEquals("研发", result.getList().get(1).getPostNames());
        verify(userPostMapper).listByUserIds(List.of(1L, 2L));
        verify(userPostMapper, never()).selectList(any());
        verify(postMapper, never()).selectList(any());
    }

    private static SysUser user(Long id, String password) {
        SysUser user = new SysUser();
        user.setId(id);
        user.setPassword(password);
        return user;
    }

    private static SysUserPost link(Long userId, Long postId) {
        SysUserPost link = new SysUserPost();
        link.setUserId(userId);
        link.setPostId(postId);
        return link;
    }

    private static SysPost post(Long id, String name) {
        SysPost post = new SysPost();
        post.setId(id);
        post.setPostName(name);
        return post;
    }
}
