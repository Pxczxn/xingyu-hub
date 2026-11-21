package top.pxczxn.xingyu.system.service.impl;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;

import java.lang.reflect.Field;

final class TestMapperSupport {

    private TestMapperSupport() {
    }

    static void injectBaseMapper(ServiceImpl<?, ?> service, BaseMapper<?> mapper) {
        Class<?> type = ServiceImpl.class;
        while (type != null) {
            try {
                Field field = type.getDeclaredField("baseMapper");
                field.setAccessible(true);
                field.set(service, mapper);
                return;
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            } catch (IllegalAccessException e) {
                throw new IllegalStateException(e);
            }
        }
        throw new IllegalStateException("ServiceImpl.baseMapper not found");
    }
}
