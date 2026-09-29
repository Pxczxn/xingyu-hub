package top.pxczxn.xingyu.community.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import top.pxczxn.xingyu.community.entity.RegistrationIdempotency;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RegistrationIdempotencyMapper extends BaseMapper<RegistrationIdempotency> {
}
